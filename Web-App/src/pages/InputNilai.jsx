import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Edit3, Check, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

export default function InputNilai() {
  const [dataKelas, setDataKelas] = useState([]);
  const [dataMapel, setDataMapel] = useState([]);
  const [rawMapels, setRawMapels] = useState([]); // Simpan semua mapel
  const [myPembelajaran, setMyPembelajaran] = useState([]); // Simpan relasi kelas <-> mapel guru

  const [dataTP, setDataTP] = useState([]); // State untuk Tujuan Pembelajaran
  
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  
  const [filterTahun, setFilterTahun] = useState(defaultTahun);
  const [filterSemester, setFilterSemester] = useState('Ganjil');
  
  // Kita simpan string JSON agar bisa mendapat ID dan NAMA sekaligus
  const [selectedKelasJson, setSelectedKelasJson] = useState('');
  const [selectedMapelJson, setSelectedMapelJson] = useState('');
  
  const [dataNilai, setDataNilai] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [resKelas, resMapel] = await Promise.all([
          supabase.from('data_kelas').select('id, nama_kelas, tingkat').order('nama_kelas', { ascending: true }),
          supabase.from('data_mapel').select('id, nama_mapel').order('urutan', { ascending: true })
        ]);

        let kelases = resKelas.data || [];
        let mapels = resMapel.data || [];
        setRawMapels(mapels); // Simpan aslinya

        // Filter Kelas dan Mapel berdasarkan Guru yang login dari tabel `pembelajaran`
        const userSession = localStorage.getItem('user_guru');
        if (userSession) {
          const userObj = JSON.parse(userSession);
          if (userObj && userObj.id) {
            // Mengambil dari tabel pembelajaran (Atur Pembelajaran)
            const { data: pembData } = await supabase
              .from('pembelajaran')
              .select('kelas_id, mapel_id')
              .eq('guru_id', userObj.id);

            if (pembData && pembData.length > 0) {
              setMyPembelajaran(pembData);
              const myKelasIds = [...new Set(pembData.map(p => Number(p.kelas_id)))];
              const myMapelIds = [...new Set(pembData.map(p => Number(p.mapel_id)))];
              
              kelases = kelases.filter(k => myKelasIds.includes(k.id));
              mapels = mapels.filter(m => myMapelIds.includes(m.id));
            } else {
              kelases = [];
              mapels = [];
            }
          }
        }

        setDataKelas(kelases);
        setDataMapel(mapels);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMasterData();
  }, []);

  // Filter dinamis: Jika kelas dipilih, hanya tampilkan mapel yang diajar di kelas tersebut
  useEffect(() => {
    if (selectedKelasJson && myPembelajaran.length > 0) {
      const kelasObj = JSON.parse(selectedKelasJson);
      const allowedMapelIds = myPembelajaran
        .filter(p => Number(p.kelas_id) === kelasObj.id)
        .map(p => Number(p.mapel_id));
        
      setDataMapel(rawMapels.filter(m => allowedMapelIds.includes(m.id)));
      
      // Reset pilihan mapel jika mapel yg dipilih sebelumnya tidak ada di kelas ini
      if (selectedMapelJson) {
         const mapelObj = JSON.parse(selectedMapelJson);
         if (!allowedMapelIds.includes(mapelObj.id)) {
            setSelectedMapelJson('');
         }
      }
    } else if (!selectedKelasJson && myPembelajaran.length > 0) {
      // Jika tidak ada kelas dipilih, kembalikan ke semua mapel yang diajar guru
      const allMyMapelIds = [...new Set(myPembelajaran.map(p => Number(p.mapel_id)))];
      setDataMapel(rawMapels.filter(m => allMyMapelIds.includes(m.id)));
    }
  }, [selectedKelasJson, myPembelajaran, rawMapels]);

  const fetchSiswaDanNilai = async () => {
    if (!selectedKelasJson || !selectedMapelJson) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih Kelas dan Mata Pelajaran terlebih dahulu!' });
      return;
    }

    const kelasObj = JSON.parse(selectedKelasJson);
    const mapelObj = JSON.parse(selectedMapelJson);

    setIsLoading(true);
    try {
      // 1. Ambil Tujuan Pembelajaran (Capaian TP) untuk dropdown berdasarkan Mapel & Kelas
      const { data: tpData, error: tpError } = await supabase
        .from('tujuan_pembelajaran')
        .select('id, tujuan_pembelajaran')
        .eq('id_mapel', mapelObj.id)
        .eq('id_kelas', String(kelasObj.tingkat))
        .eq('semester', filterSemester)
        .eq('tahun_pelajaran', filterTahun)
        .eq('status', true);
        
      if (tpError) console.error("Error fetch TP:", tpError);
      setDataTP(tpData || []);

      // 2. Ambil data siswa di kelas tersebut (berdasarkan nama kelas karena di data_siswa simpannya string)
      const { data: siswaData, error: siswaError } = await supabase
        .from('data_siswa')
        .select('id, nipd, nisn, nama')
        .eq('kelas', kelasObj.nama)
        .eq('status_keaktifan', 'Aktif')
        .order('nama', { ascending: true });

      if (siswaError) throw siswaError;

      if (!siswaData || siswaData.length === 0) {
        setDataNilai([]);
        Swal.fire('Info', 'Tidak ada siswa yang terdaftar di kelas ini.', 'info');
        return;
      }

      // 3. Ambil nilai yang sudah ada dari database (Berdasarkan ID Kelas dan ID Mapel)
      const nipdList = siswaData.map(s => s.nipd);
      const { data: existingNilai, error: nilaiError } = await supabase
        .from('nilai_siswa')
        .select('*')
        .eq('tahun_ajaran', filterTahun)
        .eq('semester', filterSemester)
        .eq('id_kelas', String(kelasObj.id)) // Menggunakan id_kelas
        .eq('id_mapel', String(mapelObj.id)) // Menggunakan id_mapel
        .in('nipd', nipdList);

      if (nilaiError) throw nilaiError;

      // 4. Gabungkan data
      const combinedData = siswaData.map(siswa => {
        const nilaiSiswa = (existingNilai || []).filter(n => n.nipd === siswa.nipd);
        const tugas1 = nilaiSiswa.find(n => n.jenis_nilai === 'Tugas 1');
        const tugas2 = nilaiSiswa.find(n => n.jenis_nilai === 'Tugas 2');
        const tugas3 = nilaiSiswa.find(n => n.jenis_nilai === 'Tugas 3');
        const tugas4 = nilaiSiswa.find(n => n.jenis_nilai === 'Tugas 4');
        const pts = nilaiSiswa.find(n => n.jenis_nilai === 'PTS');
        const pas = nilaiSiswa.find(n => n.jenis_nilai === 'PAS');
        
        // Ambil id_tujuan_pemb dari salah satu row jika sudah pernah diisi
        let rawCapaian = (tugas1?.id_tujuan_pemb || tugas2?.id_tujuan_pemb || tugas3?.id_tujuan_pemb || tugas4?.id_tujuan_pemb || pts?.id_tujuan_pemb || pas?.id_tujuan_pemb);
        let optimal = [];
        let peningkatan = [];
        if (rawCapaian) {
           try {
              const parsed = JSON.parse(rawCapaian);
              optimal = parsed.optimal || [];
              peningkatan = parsed.peningkatan || [];
           } catch(e) {
              // Ignore if it's old non-JSON data
           }
        }

        return {
          id_siswa: siswa.id,
          nipd: siswa.nipd,
          nisn: siswa.nisn,
          nama_lengkap: siswa.nama,
          nilai_tugas_1: tugas1 ? tugas1.nilai_siswa : '',
          nilai_tugas_2: tugas2 ? tugas2.nilai_siswa : '',
          nilai_tugas_3: tugas3 ? tugas3.nilai_siswa : '',
          nilai_tugas_4: tugas4 ? tugas4.nilai_siswa : '',
          nilai_pts: pts ? pts.nilai_siswa : '',
          nilai_pas: pas ? pas.nilai_siswa : '',
          capaian_optimal: optimal,
          capaian_peningkatan: peningkatan
        };
      });

      setDataNilai(combinedData);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', `Gagal memuat data. Detail: ${err.message || JSON.stringify(err)}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (index, field, value) => {
    const newData = [...dataNilai];
    newData[index][field] = value;
    setDataNilai(newData);
  };

  const handleCheckboxChange = (index, listName, tpId, isChecked) => {
    const newData = [...dataNilai];
    const currentList = newData[index][listName] || [];
    if (isChecked) {
      newData[index][listName] = [...currentList, tpId];
    } else {
      newData[index][listName] = currentList.filter(id => id !== tpId);
    }
    setDataNilai(newData);
  };

  const handleSimpan = async () => {
    if (dataNilai.length === 0) return;
    
    setIsSaving(true);
    try {
      const kelasObj = JSON.parse(selectedKelasJson);
      const mapelObj = JSON.parse(selectedMapelJson);
      
      const payload = [];
      const nik_guru = 'admin';

      dataNilai.forEach(siswa => {
        let capaianValue = null;
        if (siswa.capaian_optimal?.length || siswa.capaian_peningkatan?.length) {
           capaianValue = JSON.stringify({
              optimal: siswa.capaian_optimal || [],
              peningkatan: siswa.capaian_peningkatan || []
           });
        }

        const baseRow = {
          tahun_ajaran: filterTahun,
          semester: filterSemester,
          id_kelas: String(kelasObj.id),
          id_mapel: String(mapelObj.id),
          nipd: siswa.nipd,
          id_tujuan_pemb: capaianValue,
          nik_guru: nik_guru
        };

        if (siswa.nilai_tugas_1 !== '') {
          payload.push({ ...baseRow, jenis_nilai: 'Tugas 1', nilai_siswa: parseInt(siswa.nilai_tugas_1) || 0 });
        }
        if (siswa.nilai_tugas_2 !== '') {
          payload.push({ ...baseRow, jenis_nilai: 'Tugas 2', nilai_siswa: parseInt(siswa.nilai_tugas_2) || 0 });
        }
        if (siswa.nilai_tugas_3 !== '') {
          payload.push({ ...baseRow, jenis_nilai: 'Tugas 3', nilai_siswa: parseInt(siswa.nilai_tugas_3) || 0 });
        }
        if (siswa.nilai_tugas_4 !== '') {
          payload.push({ ...baseRow, jenis_nilai: 'Tugas 4', nilai_siswa: parseInt(siswa.nilai_tugas_4) || 0 });
        }
        if (siswa.nilai_pts !== '') {
          payload.push({ ...baseRow, jenis_nilai: 'PTS', nilai_siswa: parseInt(siswa.nilai_pts) || 0 });
        }
        if (siswa.nilai_pas !== '') {
          payload.push({ ...baseRow, jenis_nilai: 'PAS', nilai_siswa: parseInt(siswa.nilai_pas) || 0 });
        }
      });

      if (payload.length > 0) {
        const { error } = await supabase
          .from('nilai_siswa')
          .upsert(payload, { onConflict: 'tahun_ajaran, semester, id_kelas, id_mapel, jenis_nilai, nipd' });
          
        if (error) throw error;
      }

      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data nilai berhasil disimpan ke database.', timer: 1500 });
    } catch (err) {
      console.error(err);
      Swal.fire('Error', `Gagal menyimpan nilai: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Hitung Peringkat secara dinamis
  const ranksMap = {};
  if (dataNilai.length > 0) {
    const scoredData = dataNilai.map(item => {
      const scores = [
        parseFloat(item.nilai_tugas_1), parseFloat(item.nilai_tugas_2),
        parseFloat(item.nilai_tugas_3), parseFloat(item.nilai_tugas_4),
        parseFloat(item.nilai_pts), parseFloat(item.nilai_pas)
      ].filter(v => !isNaN(v));

      const total = scores.reduce((sum, v) => sum + v, 0);
      const avg = scores.length > 0 ? (total / scores.length) : 0;
      return { nipd: item.nipd, avg: avg };
    });
    scoredData.sort((a, b) => b.avg - a.avg);
    let currentRank = 1;
    scoredData.forEach((sd, index) => {
      if (index > 0 && sd.avg < scoredData[index-1].avg) {
        currentRank = index + 1;
      }
      ranksMap[sd.nipd] = { rank: currentRank, avg: sd.avg };
    });
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Edit3 className="text-primary" /> Input Nilai Akademik
          </h2>
          <p className="text-gray-500 text-sm mt-1">Masukkan nilai tugas, PTS, dan PAS siswa per mata pelajaran.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleSimpan} 
            disabled={isSaving || dataNilai.length === 0}
            className="bg-primary hover:bg-blue-900 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm"
          >
            {isSaving ? 'Menyimpan...' : <><Check size={16} /> Simpan Nilai</>}
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-end">
        
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tahun Pelajaran</label>
          <select 
            value={filterTahun} onChange={e => { setFilterTahun(e.target.value); setDataNilai([]); }}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none text-sm font-semibold"
          >
            <option value={`${currentYear - 1}/${currentYear}`}>{currentYear - 1}/{currentYear}</option>
            <option value={`${currentYear}/${currentYear + 1}`}>{currentYear}/{currentYear + 1}</option>
            <option value={`${currentYear + 1}/${currentYear + 2}`}>{currentYear + 1}/{currentYear + 2}</option>
          </select>
        </div>

        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Semester</label>
          <select 
            value={filterSemester} onChange={e => { setFilterSemester(e.target.value); setDataNilai([]); }}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none text-sm font-semibold"
          >
            <option value="Ganjil">Ganjil</option>
            <option value="Genap">Genap</option>
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kelas</label>
          <select 
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none text-sm font-semibold"
            value={selectedKelasJson}
            onChange={(e) => { setSelectedKelasJson(e.target.value); setDataNilai([]); }}
          >
            <option value="">-- Pilih Kelas --</option>
            {dataKelas.map((k, idx) => (
              <option key={idx} value={JSON.stringify({id: k.id, nama: k.nama_kelas, tingkat: k.tingkat})}>
                {k.nama_kelas}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mata Pelajaran</label>
          <select 
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none text-sm font-semibold"
            value={selectedMapelJson}
            onChange={(e) => { setSelectedMapelJson(e.target.value); setDataNilai([]); }}
          >
            <option value="">-- Pilih Mapel --</option>
            {dataMapel.map((m, idx) => (
              <option key={idx} value={JSON.stringify({id: m.id, nama: m.nama_mapel})}>
                {m.nama_mapel}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-none">
          <button onClick={fetchSiswaDanNilai} disabled={isLoading} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-6 py-2.5 rounded-lg font-bold transition flex items-center gap-2 text-sm h-[42px]">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Tampilkan
          </button>
        </div>
      </div>

      {dataNilai.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
                <tr>
                  <th className="px-4 py-4 w-10 text-center">No</th>
                  <th className="px-4 py-4 min-w-[200px]">Nama Siswa</th>
                  <th className="px-2 py-4 w-16 text-center">Tugas 1</th>
                  <th className="px-2 py-4 w-16 text-center">Tugas 2</th>
                  <th className="px-2 py-4 w-16 text-center">Tugas 3</th>
                  <th className="px-2 py-4 w-16 text-center">Tugas 4</th>
                  <th className="px-2 py-4 w-16 text-center">PTS</th>
                  <th className="px-2 py-4 w-16 text-center">PAS</th>
                  <th className="px-4 py-4 w-20 text-center text-blue-700">Rapor</th>
                  <th className="px-4 py-4 w-20 text-center text-primary">Peringkat</th>
                  <th className="px-4 py-4 min-w-[250px] border-l border-gray-100 bg-blue-50/50">TP Tercapai dengan Optimal</th>
                  <th className="px-4 py-4 min-w-[250px] border-l border-gray-100 bg-red-50/50">TP yang Perlu Peningkatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {dataNilai.map((item, idx) => (
                  <tr key={item.nipd} className="hover:bg-gray-50 transition border-b border-gray-100">
                    <td className="px-4 py-4 text-center text-gray-500 align-top">{idx + 1}</td>
                    <td className="px-4 py-4 font-semibold text-gray-800 align-top">
                      {item.nama_lengkap} <br/><span className="text-xs text-gray-400 font-normal">{item.nisn} / {item.nipd}</span>
                    </td>
                    <td className="px-2 py-4 align-top">
                      <input 
                        type="number" 
                        min="0" max="100"
                        value={item.nilai_tugas_1} 
                        onChange={(e) => handleInputChange(idx, 'nilai_tugas_1', e.target.value)}
                        className="w-full px-1 py-2 border rounded-lg text-center focus:ring-2 focus:ring-primary outline-none" 
                      />
                    </td>
                    <td className="px-2 py-4 align-top">
                      <input 
                        type="number" 
                        min="0" max="100"
                        value={item.nilai_tugas_2} 
                        onChange={(e) => handleInputChange(idx, 'nilai_tugas_2', e.target.value)}
                        className="w-full px-1 py-2 border rounded-lg text-center focus:ring-2 focus:ring-primary outline-none" 
                      />
                    </td>
                    <td className="px-2 py-4 align-top">
                      <input 
                        type="number" 
                        min="0" max="100"
                        value={item.nilai_tugas_3} 
                        onChange={(e) => handleInputChange(idx, 'nilai_tugas_3', e.target.value)}
                        className="w-full px-1 py-2 border rounded-lg text-center focus:ring-2 focus:ring-primary outline-none" 
                      />
                    </td>
                    <td className="px-2 py-4 align-top">
                      <input 
                        type="number" 
                        min="0" max="100"
                        value={item.nilai_tugas_4} 
                        onChange={(e) => handleInputChange(idx, 'nilai_tugas_4', e.target.value)}
                        className="w-full px-1 py-2 border rounded-lg text-center focus:ring-2 focus:ring-primary outline-none" 
                      />
                    </td>
                    <td className="px-2 py-4 align-top">
                      <input 
                        type="number" 
                        min="0" max="100"
                        value={item.nilai_pts} 
                        onChange={(e) => handleInputChange(idx, 'nilai_pts', e.target.value)}
                        className="w-full px-1 py-2 border rounded-lg text-center focus:ring-2 focus:ring-primary outline-none" 
                      />
                    </td>
                    <td className="px-2 py-4 align-top">
                      <input 
                        type="number" 
                        min="0" max="100"
                        value={item.nilai_pas} 
                        onChange={(e) => handleInputChange(idx, 'nilai_pas', e.target.value)}
                        className="w-full px-1 py-2 border rounded-lg text-center focus:ring-2 focus:ring-primary outline-none" 
                      />
                    </td>
                    <td className="px-4 py-4 align-top text-center">
                      <div className="font-bold text-xl text-blue-700 mt-1">{ranksMap[item.nipd]?.avg?.toFixed(1) || '-'}</div>
                    </td>
                    <td className="px-4 py-4 align-top text-center">
                      <div className="font-bold text-xl text-primary mt-1">{ranksMap[item.nipd]?.rank || '-'}</div>
                    </td>
                    <td className="px-4 py-4 align-top border-l border-gray-100">
                      {dataTP.map(tp => (
                        <label key={tp.id} className="flex items-start gap-2 mb-3 text-sm text-gray-700 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={item.capaian_optimal?.includes(tp.id)}
                            onChange={(e) => handleCheckboxChange(idx, 'capaian_optimal', tp.id, e.target.checked)}
                            className="mt-1 rounded text-primary w-4 h-4"
                          />
                          <span className="leading-tight flex-1">{tp.tujuan_pembelajaran}</span>
                        </label>
                      ))}
                      {dataTP.length === 0 && <span className="text-xs text-gray-400 italic">TP belum diatur</span>}
                    </td>
                    <td className="px-4 py-4 align-top border-l border-gray-100">
                      {dataTP.map(tp => (
                        <label key={tp.id} className="flex items-start gap-2 mb-3 text-sm text-gray-700 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={item.capaian_peningkatan?.includes(tp.id)}
                            onChange={(e) => handleCheckboxChange(idx, 'capaian_peningkatan', tp.id, e.target.checked)}
                            className="mt-1 rounded text-red-500 focus:ring-red-500 w-4 h-4"
                          />
                          <span className="leading-tight flex-1">{tp.tujuan_pembelajaran}</span>
                        </label>
                      ))}
                      {dataTP.length === 0 && <span className="text-xs text-gray-400 italic">TP belum diatur</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !isLoading && (
          <div className="bg-white p-12 rounded-xl border border-gray-100 flex flex-col items-center justify-center text-gray-400">
            <Edit3 size={48} className="opacity-20 mb-3" />
            <p>Silakan pilih Tahun Pelajaran, Semester, Kelas, dan Mapel terlebih dahulu.</p>
          </div>
        )
      )}
    </div>
  );
}
