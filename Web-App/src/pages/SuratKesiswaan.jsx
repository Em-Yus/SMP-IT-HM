import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Printer, Search, UserCheck, ArrowRightLeft, FileSignature, GraduationCap, Mail, Plus, RefreshCw, ArrowLeft, Trash2, Edit, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { useLocation, useNavigate } from 'react-router-dom';
import KopSurat from '../components/KopSurat';

export default function SuratKesiswaan() {
  const location = useLocation();
  const navigate = useNavigate();

  const [dataLembaga, setDataLembaga] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [dataSurat, setDataSurat] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [currentTab, setCurrentTab] = useState('penerimaan');
  const [selectedSiswa, setSelectedSiswa] = useState(null);

  // Form State - Surat
  const [noSurat, setNoSurat] = useState('');
  const [tglSurat, setTglSurat] = useState(new Date().toISOString().split('T')[0]);
  const [nextNumber, setNextNumber] = useState(1);

  // Form State - Penerimaan
  const [penerimaanAsal, setPenerimaanAsal] = useState('');
  const [penerimaanNoSuratAsal, setPenerimaanNoSuratAsal] = useState('');
  const [penerimaanTglSuratAsal, setPenerimaanTglSuratAsal] = useState('');

  // Form State - Pindah
  const [pindahTujuan, setPindahTujuan] = useState('');
  const [pindahAlamatTujuan, setPindahAlamatTujuan] = useState('');
  const [pindahAlasan, setPindahAlasan] = useState('');

  // Form State - Kelulusan
  const [lulusTahunAjaran, setLulusTahunAjaran] = useState(() => {
    const y = new Date().getFullYear();
    return `${y-1}/${y}`;
  });
  const [daftarSiswaLulus, setDaftarSiswaLulus] = useState([]);

  // Options State
  const [daftarKelas, setDaftarKelas] = useState([]);
  const [filterKelas, setFilterKelas] = useState('');
  const [daftarSiswaKelas, setDaftarSiswaKelas] = useState([]);
  const [selectSiswaIdx, setSelectSiswaIdx] = useState('');

  // Search state
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const fetchTableData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_surat')
        .select('*')
        .in('jenis_surat', ['PENERIMAAN', 'PINDAH', 'KELULUSAN'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Ambil data siswa untuk mapping nama
      const { data: dataSiswa } = await supabase.from('data_siswa').select('nipd, nama, id');
      const mapSiswa = {};
      if (dataSiswa) {
        dataSiswa.forEach(s => {
          if (s.nipd) mapSiswa[s.nipd] = s.nama;
          mapSiswa[s.id] = s.nama;
        });
      }
      
      const mappedData = (data || []).map(item => ({
        ...item,
        nama_siswa: mapSiswa[item.nipd] || item.nipd || '-'
      }));

      setDataSurat(mappedData);
    } catch (err) {
      console.error(err);
      setDataSurat([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchLembaga = async () => {
      const { data } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (data) setDataLembaga(data);
    };
    fetchLembaga();
    fetchTableData();
    fetchKelas();
  }, []);

  useEffect(() => {
    // Check if navigated from DataSiswa with pindah state
    if (location.state && location.state.type === 'pindah' && location.state.siswa) {
      setIsCreating(true);
      setCurrentTab('pindah');
      const siswa = location.state.siswa;
      setSelectedSiswa(siswa);

      if (siswa.kelas) {
        setFilterKelas(siswa.kelas);
        loadSiswaKelas(siswa.kelas).then(data => {
          const idx = data.findIndex(s => s.nipd === siswa.nipd);
          if (idx !== -1) setSelectSiswaIdx(idx);
        });
      }
      generateNomorSurat('pindah');

      // Bersihkan state agar tidak langsung isCreating jika direfresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Effect untuk Kelulusan Masal
  useEffect(() => {
    if (currentTab === 'lulus' && !editingId) {
      const fetchLulus = async () => {
        let query = supabase.from('data_siswa').select('*').eq('status_keaktifan', 'Aktif');
        if (filterKelas && filterKelas !== 'Semua') {
          query = query.eq('kelas', filterKelas);
        } else {
          // Asumsi kelas 9 berawalan IX atau 9, tapi untuk amannya ambil semua atau yang difilter.
          // Secara default tampilkan yang kelasnya mengandung 'IX' atau '9'
          query = query.or('kelas.ilike.IX%,kelas.ilike.9%');
        }
        const { data } = await query.order('nama');
        setDaftarSiswaLulus(data || []);
      };
      fetchLulus();
    }
  }, [filterKelas, currentTab, editingId]);

  const fetchKelas = async () => {
    const { data } = await supabase.from('data_kelas').select('nama_kelas').neq('nama_kelas', 'Calon Siswa').order('nama_kelas');
    if (data) setDaftarKelas(data);
  };

  const getLatestNomorSurat = async (year) => {
    const { data } = await supabase
      .from('data_surat')
      .select('nomor_urut')
      .eq('tahun', year)
      .not('nomor_urut', 'is', null)
      .order('nomor_urut', { ascending: false })
      .limit(1);
    
    if (data && data.length > 0 && data[0].nomor_urut) {
      return data[0].nomor_urut + 1;
    }
    return 1;
  };

  const generateNomorSurat = async (tab) => {
    const year = new Date().getFullYear();
    const code = tab === 'penerimaan' ? 'PPDB' : tab === 'pindah' ? 'KS' : 'SKL';

    try {
      const nextNum = await getLatestNomorSurat(year);
      setNextNumber(nextNum);
      const formattedNum = String(nextNum).padStart(3, '0');
      const fullNo = `421.3/${formattedNum}/SMP-HM/${code}/${year}`;
      setNoSurat(fullNo);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTabSwitch = (tab) => {
    setCurrentTab(tab);
    setSelectedSiswa(null);
    setSearchKeyword('');
    setFilterKelas('');
    setSelectSiswaIdx('');
    generateNomorSurat(tab);
  };

  const handleSearchSiswa = async (e) => {
    const keyword = e.target.value;
    setSearchKeyword(keyword);
    if (keyword.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    const { data } = await supabase
      .from('data_siswa')
      .select('*')
      .eq('status_keaktifan', 'Aktif')
      .or(`nama.ilike.%${keyword}%,nisn.ilike.%${keyword}%`)
      .limit(10);
    setSearchResults(data || []);
    setShowSearchDropdown(true);
  };

  const selectSiswaFromSearch = (s) => {
    setSelectedSiswa(s);
    setSearchKeyword(s.nama);
    setShowSearchDropdown(false);
  };

  const loadSiswaKelas = async (kelas) => {
    if (!kelas) {
      setDaftarSiswaKelas([]);
      return [];
    }
    const { data } = await supabase.from('data_siswa').select('*').eq('status_keaktifan', 'Aktif').eq('kelas', kelas).order('nama');
    const result = data || [];
    setDaftarSiswaKelas(result);
    return result;
  };

  const handleFilterKelasChange = async (e) => {
    const kls = e.target.value;
    setFilterKelas(kls);
    setSelectSiswaIdx('');
    setSelectedSiswa(null);
    await loadSiswaKelas(kls);
  };

  const handleSelectSiswaPindah = (e) => {
    const idx = e.target.value;
    setSelectSiswaIdx(idx);
    if (idx !== '') {
      setSelectedSiswa(daftarSiswaKelas[idx]);
    } else {
      setSelectedSiswa(null);
    }
  };

  const handleEditCetak = async (item) => {
    setIsLoading(true);
    try {
      let siswaData = null;
      if (item.nipd) {
        const { data: sData } = await supabase.from('data_siswa').select('*').eq('nipd', item.nipd).maybeSingle();
        siswaData = sData;
      }
      
      const tab = item.jenis_surat === 'PENERIMAAN' ? 'penerimaan' : item.jenis_surat === 'PINDAH' ? 'pindah' : 'lulus';
      setCurrentTab(tab);
      setSelectedSiswa(siswaData);
      setEditingId(item.id);
      
      setNoSurat(item.meta_data?.no_surat || '');
      setTglSurat(item.meta_data?.tgl_surat || new Date().toISOString().split('T')[0]);
      
      if (tab === 'penerimaan') {
        setPenerimaanAsal(item.meta_data?.detail?.asal || '');
        setPenerimaanNoSuratAsal(item.meta_data?.detail?.no_asal || '');
        setPenerimaanTglSuratAsal(item.meta_data?.detail?.tgl_asal || '');
      } else if (tab === 'pindah') {
        setPindahTujuan(item.meta_data?.detail?.tujuan || '');
        setPindahAlasan(item.meta_data?.detail?.alasan || '');
      } else {
        setLulusTahunAjaran(item.meta_data?.detail?.tahun_ajaran || '');
      }
      
      setIsCreating(true);
    } catch(e) {
      console.error(e);
      Swal.fire('Error', 'Gagal memuat data surat.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const prosesKelulusanMasal = async () => {
    if (daftarSiswaLulus.length === 0) {
      Swal.fire('Peringatan', 'Tidak ada siswa aktif yang ditemukan untuk kelas ini.', 'warning');
      return;
    }

    Swal.fire({
      title: 'Konfirmasi Kelulusan',
      text: `Anda akan meluluskan ${daftarSiswaLulus.length} siswa dan membuatkan ${daftarSiswaLulus.length} Surat Keterangan Lulus (SKL). Lanjutkan?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Luluskan!',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2a2c87'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          Swal.fire({ title: 'Memproses...', text: 'Mohon tunggu, sedang men-generate surat dan mengupdate status.', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

          const year = new Date().getFullYear();
          let currentNum = await getLatestNomorSurat(year);
          
          const lettersToInsert = daftarSiswaLulus.map((siswa, idx) => {
            const formattedNum = String(currentNum + idx).padStart(3, '0');
            const generatedNoSurat = `421.3/${formattedNum}/SMP-HM/SKL/${year}`;
            return {
              jenis_surat: 'KELULUSAN',
              nomor_urut: currentNum + idx,
              tahun: year,
              nipd: siswa.nipd || siswa.id,
              meta_data: {
                no_surat: generatedNoSurat,
                tgl_surat: tglSurat,
                detail: {
                  tahun_ajaran: lulusTahunAjaran
                }
              }
            };
          });

          // 1. Bulk Insert Letters
          const { error: errInsert } = await supabase.from('data_surat').insert(lettersToInsert);
          if (errInsert) throw errInsert;

          // 2. Bulk Update Siswa Status
          const studentIds = daftarSiswaLulus.map(s => s.id);
          // Supabase JS doesn't support bulk update with array in a single simple query via .update().in(), 
          // wait, actually .update().in('id', array) IS supported in PostgREST!
          const { error: errUpdate } = await supabase
            .from('data_siswa')
            .update({ status_keaktifan: 'Lulus', tanggal_non_aktif: tglSurat })
            .in('id', studentIds);
            
          if (errUpdate) throw errUpdate;

          Swal.fire('Berhasil!', `${daftarSiswaLulus.length} SKL berhasil dibuat dan status siswa menjadi Lulus.`, 'success');
          resetForm();
        } catch (e) {
          console.error(e);
          Swal.fire('Error', 'Terjadi kesalahan saat memproses kelulusan masal.', 'error');
        }
      }
    });
  };

  const simpanDanCetak = async () => {
    if (!selectedSiswa) {
      Swal.fire('Peringatan', 'Pilih siswa terlebih dahulu!', 'warning');
      return;
    }

    const year = new Date().getFullYear();
    const jenis = currentTab === 'penerimaan' ? 'PENERIMAAN' : currentTab === 'pindah' ? 'PINDAH' : 'KELULUSAN';

    try {
      Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

      if (!editingId) {
        if (currentTab === 'lulus') {
            Swal.fire('Peringatan', 'Gunakan tombol Proses Kelulusan Masal.', 'warning');
            return;
        }

        const latestNumber = await getLatestNomorSurat(year);
        const code = currentTab === 'penerimaan' ? 'PPDB' : currentTab === 'pindah' ? 'KS' : 'SKL';
        const formattedNum = String(latestNumber).padStart(3, '0');
        const generatedNoSurat = `421.3/${formattedNum}/SMP-HM/${code}/${year}`;

        const { error } = await supabase
          .from('data_surat')
          .insert([{
            jenis_surat: jenis,
            nomor_urut: latestNumber,
            tahun: year,
            nipd: selectedSiswa.nipd || selectedSiswa.id,
            meta_data: {
              no_surat: generatedNoSurat,
              tgl_surat: tglSurat,
              detail: currentTab === 'penerimaan' ? {
                asal: penerimaanAsal,
                no_asal: penerimaanNoSuratAsal,
                tgl_asal: penerimaanTglSuratAsal
              } : {
                tujuan: pindahTujuan,
                alasan: pindahAlasan
              }
            }
          }]);

        if (error) throw error;

        if (currentTab === 'pindah' && selectedSiswa.id) {
          const { error: errUpdate } = await supabase
            .from('data_siswa')
            .update({ tanggal_non_aktif: tglSurat, status_keaktifan: 'Pindah' })
            .eq('id', selectedSiswa.id);
          if (errUpdate) console.warn('Gagal update status siswa:', errUpdate.message);
        }
      } else {
        // Mode Update / Cetak Ulang
        const { error } = await supabase
          .from('data_surat')
          .update({
            meta_data: {
              no_surat: noSurat,
              tgl_surat: tglSurat,
              detail: currentTab === 'penerimaan' ? {
                asal: penerimaanAsal,
                no_asal: penerimaanNoSuratAsal,
                tgl_asal: penerimaanTglSuratAsal
              } : currentTab === 'pindah' ? {
                tujuan: pindahTujuan,
                alasan: pindahAlasan
              } : {
                tahun_ajaran: lulusTahunAjaran
              }
            }
          })
          .eq('id', editingId);
          
        if (error) throw error;
      }

      Swal.close();

      executePrint();

    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal menyimpan nomor surat: ' + e.message, 'error');
    }
  };

  const simpanSaja = async () => {
    if (!selectedSiswa) {
      Swal.fire('Peringatan', 'Pilih siswa terlebih dahulu!', 'warning');
      return;
    }

    const year = new Date().getFullYear();
    const jenis = currentTab === 'penerimaan' ? 'PENERIMAAN' : currentTab === 'pindah' ? 'PINDAH' : 'KELULUSAN';

    try {
      Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

      if (!editingId) {
        if (currentTab === 'lulus') {
            Swal.fire('Peringatan', 'Gunakan tombol Proses Kelulusan Masal.', 'warning');
            return;
        }

        const latestNumber = await getLatestNomorSurat(year);
        const code = currentTab === 'penerimaan' ? 'PPDB' : currentTab === 'pindah' ? 'KS' : 'SKL';
        const formattedNum = String(latestNumber).padStart(3, '0');
        const generatedNoSurat = `421.3/${formattedNum}/SMP-HM/${code}/${year}`;

        const { error } = await supabase
          .from('data_surat')
          .insert([{
            jenis_surat: jenis,
            nomor_urut: latestNumber,
            tahun: year,
            nipd: selectedSiswa.nipd || selectedSiswa.id,
            meta_data: {
              no_surat: generatedNoSurat,
              tgl_surat: tglSurat,
              detail: currentTab === 'penerimaan' ? {
                asal: penerimaanAsal,
                no_asal: penerimaanNoSuratAsal,
                tgl_asal: penerimaanTglSuratAsal
              } : {
                tujuan: pindahTujuan,
                alasan: pindahAlasan
              }
            }
          }]);

        if (error) throw error;

        if (currentTab === 'pindah' && selectedSiswa.id) {
          const { error: errUpdate } = await supabase
            .from('data_siswa')
            .update({ tanggal_non_aktif: tglSurat, status_keaktifan: 'Pindah' })
            .eq('id', selectedSiswa.id);
        }
      } else {
        const { error } = await supabase
          .from('data_surat')
          .update({
            meta_data: {
              no_surat: noSurat,
              tgl_surat: tglSurat,
              detail: currentTab === 'penerimaan' ? {
                asal: penerimaanAsal,
                no_asal: penerimaanNoSuratAsal,
                tgl_asal: penerimaanTglSuratAsal
              } : currentTab === 'pindah' ? {
                tujuan: pindahTujuan,
                alasan: pindahAlasan
              } : {
                tahun_ajaran: lulusTahunAjaran
              }
            }
          })
          .eq('id', editingId);
          
        if (error) throw error;
      }

      Swal.fire('Berhasil!', 'Data surat berhasil disimpan.', 'success');
      resetForm();

    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal menyimpan surat: ' + e.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    Swal.fire({
      title: 'Hapus Surat?',
      text: 'Data surat ini akan dihapus secara permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#d33'
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { error } = await supabase.from('data_surat').delete().eq('id', id);
        if (!error) {
          Swal.fire('Terhapus!', 'Data surat telah dihapus.', 'success');
          fetchTableData();
        } else {
          Swal.fire('Gagal!', 'Terjadi kesalahan saat menghapus.', 'error');
        }
      }
    });
  };

  const executePrint = () => {
    const printArea = document.getElementById('printableArea');
    const rootArea = document.getElementById('root');
    
    if (!printArea || !rootArea) {
      window.print();
      resetForm();
      return;
    }

    // Save original position
    const parent = printArea.parentNode;
    const nextSibling = printArea.nextSibling;
    
    // Move to body and hide root
    document.body.appendChild(printArea);
    rootArea.style.display = 'none';
    
    const cleanup = () => {
      rootArea.style.display = '';
      if (nextSibling) {
        parent.insertBefore(printArea, nextSibling);
      } else {
        parent.appendChild(printArea);
      }
      window.removeEventListener('afterprint', cleanup);
      resetForm();
    };
    
    window.addEventListener('afterprint', cleanup);
    
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const resetForm = () => {
    fetchTableData();
    generateNomorSurat(currentTab);
    setIsCreating(false);
    setEditingId(null);
  };

  // Rendering Helpers
  const renderTglLahirSiswa = () => {
    if (!selectedSiswa || !selectedSiswa.tanggal_lahir) return '-';
    const d = new Date(selectedSiswa.tanggal_lahir);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const renderKelasTingkat = () => {
    if (!selectedSiswa || !selectedSiswa.kelas) return '-';
    let k = String(selectedSiswa.kelas).toUpperCase();
    let tingkat = '';
    if (k.includes('VIII') || k.includes('8')) tingkat = 'Delapan';
    else if (k.includes('VII') || k.includes('7')) tingkat = 'Tujuh';
    else if (k.includes('IX') || k.includes('9')) tingkat = 'Sembilan';
    return `${selectedSiswa.kelas} (${tingkat})`;
  };

  const renderOrtu = () => {
    if (!selectedSiswa) return '-';
    return selectedSiswa.nama_ayah || selectedSiswa.nama_ibu || selectedSiswa.nama_wali || '-';
  };

  const renderAlamat = () => {
    if (!selectedSiswa) return '-';
    const parts = [];
    if (selectedSiswa.alamat_detail) parts.push(selectedSiswa.alamat_detail);
    if (selectedSiswa.rt && selectedSiswa.rw) parts.push(`RT ${String(selectedSiswa.rt).padStart(3, '0')} RW ${String(selectedSiswa.rw).padStart(3, '0')}`);
    if (selectedSiswa.desa) parts.push(`Desa ${selectedSiswa.desa}`);
    if (selectedSiswa.kecamatan) parts.push(`Kecamatan ${selectedSiswa.kecamatan}`);
    if (selectedSiswa.kabupaten) parts.push(`Kabupaten ${selectedSiswa.kabupaten}`);
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  const renderTglSuratFormatted = () => {
    if (!tglSurat) return '...................';
    const d = new Date(tglSurat);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // ==== TAMPILAN TABLE (ARCHIVE) ====
  if (!isCreating) {
    return (
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
              <Mail className="text-primary" /> Surat Kesiswaan
            </h2>
            <p className="text-gray-500 text-sm mt-1">Surat Panggilan Orang Tua, Surat Peringatan, Mutasi, dll.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingId(null);
                setIsCreating(true);
                generateNomorSurat(currentTab);
              }}
              className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm"
            >
              <Plus size={16} /> Buat Surat
            </button>
            <button onClick={fetchTableData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Nomor Surat</th>
                  <th className="px-6 py-4">Tipe Surat</th>
                  <th className="px-6 py-4">Nama Siswa</th>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                      Memuat data...
                    </td>
                  </tr>
                ) : dataSurat.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                      Belum ada arsip surat kesiswaan.
                    </td>
                  </tr>
                ) : (
                  dataSurat.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-semibold text-gray-800">{item.meta_data?.no_surat || '-'}</td>
                      <td className="px-6 py-4 font-bold text-primary">{item.jenis_surat === 'PENERIMAAN' ? 'Surat Penerimaan' : item.jenis_surat === 'KELULUSAN' ? 'Surat Kelulusan' : 'Surat Pindah'}</td>
                      <td className="px-6 py-4 text-gray-600">{item.nama_siswa}</td>
                      <td className="px-6 py-4 text-gray-600">{item.meta_data?.tgl_surat || '-'}</td>
                      <td className="px-6 py-4 flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEditCetak(item)}
                          className="text-blue-500 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded font-medium flex items-center gap-1"
                          title="Edit & Cetak"
                        >
                          <Edit size={14} /> Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded font-medium flex items-center gap-1"
                          title="Hapus"
                        >
                          <Trash2 size={14} /> Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==== TAMPILAN FORM (BUAT SURAT) ====
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
        <div>
          <button onClick={() => { setIsCreating(false); setEditingId(null); }} className="text-gray-500 hover:text-primary flex items-center gap-1 text-sm font-semibold mb-2">
            <ArrowLeft size={16} /> Kembali ke Arsip
          </button>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <FileSignature className="text-primary" /> {editingId ? 'Cetak Ulang Surat Kesiswaan' : 'Buat Surat Kesiswaan'}
          </h2>
          <p className="text-gray-500 text-sm mt-1">Cetak Surat Penerimaan dan Surat Pindah.</p>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
          {currentTab === 'lulus' && !editingId ? (
            <button onClick={prosesKelulusanMasal} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md">
              <GraduationCap size={18} /> Proses Kelulusan Masal
            </button>
          ) : (
            <>
              <button onClick={simpanSaja} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md">
                <Save size={18} /> Simpan Saja
              </button>
              <button onClick={simpanDanCetak} className="bg-primary hover:bg-blue-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md">
                <Printer size={18} /> {editingId ? 'Simpan & Cetak' : 'Simpan & Cetak'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 print:hidden overflow-x-auto">
        <button
          onClick={() => handleTabSwitch('penerimaan')}
          className={`py-3 px-6 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentTab === 'penerimaan' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <UserCheck size={18} /> Surat Penerimaan
        </button>
        <button
          onClick={() => handleTabSwitch('pindah')}
          className={`py-3 px-6 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentTab === 'pindah' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <ArrowRightLeft size={18} /> Surat Pindah
        </button>
        <button
          onClick={() => handleTabSwitch('lulus')}
          className={`py-3 px-6 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentTab === 'lulus' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <GraduationCap size={18} /> Surat Kelulusan (SKL)
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 pb-10 overflow-hidden print:overflow-visible">
        {/* Left Control Panel */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6 print:hidden overflow-y-auto pr-2">
          {/* Data Siswa */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
              <GraduationCap className="text-primary" size={20} /> Data Siswa
            </h3>

            {(currentTab === 'penerimaan' || (currentTab === 'lulus' && editingId)) && (
              <div className="relative">
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Cari Nama Siswa</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={handleSearchSiswa}
                    placeholder="Ketik nama siswa..."
                    className="w-full border-gray-200 border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary bg-gray-50 focus:bg-white"
                  />
                </div>
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50">
                    {searchResults.map((s, idx) => (
                      <div key={idx} onClick={() => selectSiswaFromSearch(s)} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50">
                        <p className="text-sm font-bold text-gray-800">{s.nama}</p>
                        <p className="text-xs text-gray-500">NISN: {s.nisn || '-'} | Asal: {s.sekolah_asal || '-'}</p>
                      </div>
                    ))}
                  </div>
                )}
                {showSearchDropdown && searchResults.length === 0 && (
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3">
                    <p className="text-xs italic text-gray-500 text-center">Siswa tidak ditemukan</p>
                  </div>
                )}
              </div>
            )}

            {(currentTab === 'pindah' || (currentTab === 'lulus' && !editingId)) && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{currentTab === 'lulus' ? 'Target Kelas (Untuk Diluluskan)' : 'Pilih Kelas'}</label>
                  <select value={filterKelas} onChange={handleFilterKelasChange} className="w-full border-gray-200 border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary bg-gray-50 focus:bg-white">
                    <option value="">{currentTab === 'lulus' ? 'Semua Kelas 9' : 'Pilih Kelas...'}</option>
                    {daftarKelas.map((k, i) => <option key={i} value={k.nama_kelas}>{k.nama_kelas}</option>)}
                  </select>
                </div>
                {currentTab !== 'lulus' && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Pilih Siswa</label>
                    <select value={selectSiswaIdx} onChange={handleSelectSiswaPindah} disabled={!filterKelas} className="w-full border-gray-200 border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary bg-gray-50 focus:bg-white disabled:opacity-50">
                      <option value="">Pilih Siswa...</option>
                      {daftarSiswaKelas.map((s, idx) => (
                        <option key={idx} value={idx}>{s.nama}</option>
                      ))}
                    </select>
                  </div>
                )}
                {currentTab === 'lulus' && !editingId && (
                  <div className="bg-blue-50 border border-blue-100 text-blue-700 p-3 rounded-lg text-xs mt-2">
                    Ditemukan <strong>{daftarSiswaLulus.length}</strong> siswa aktif untuk diluluskan secara masal.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detail Surat */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
              <FileSignature className="text-primary" size={20} /> Detail Surat
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Nomor Surat</label>
                <div className="flex gap-2">
                  <input type="text" value={noSurat || 'Memuat...'} readOnly className="flex-1 bg-gray-100 border-gray-200 border rounded-xl px-4 py-2.5 text-sm text-gray-600 font-mono" />
                  <button onClick={() => generateNomorSurat(currentTab)} className="text-primary hover:text-blue-700 p-2 bg-blue-50 rounded-lg"><RefreshCw size={18} /></button>
                </div>
              </div>

              {currentTab === 'penerimaan' && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Sekolah Asal</label>
                    <input type="text" value={penerimaanAsal} onChange={e => setPenerimaanAsal(e.target.value)} placeholder="Mis: SMPN 1 Contoh" className="w-full border-gray-200 border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">No Surat Asal</label>
                    <input type="text" value={penerimaanNoSuratAsal} onChange={e => setPenerimaanNoSuratAsal(e.target.value)} placeholder="Nomor Surat Pindah dari Asal" className="w-full border-gray-200 border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tgl Surat Asal</label>
                    <input type="date" value={penerimaanTglSuratAsal} onChange={e => setPenerimaanTglSuratAsal(e.target.value)} className="w-full border-gray-200 border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary bg-gray-50" />
                  </div>
                </>
              )}

              {currentTab === 'pindah' && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Sekolah Tujuan</label>
                    <input type="text" value={pindahTujuan} onChange={e => setPindahTujuan(e.target.value)} placeholder="Nama Sekolah Tujuan" className="w-full border-gray-200 border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Alamat Tujuan</label>
                    <textarea value={pindahAlamatTujuan} onChange={e => setPindahAlamatTujuan(e.target.value)} placeholder="Alamat Sekolah Tujuan" rows="2" className="w-full border-gray-200 border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary bg-gray-50"></textarea>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Alasan Pindah</label>
                    <input type="text" value={pindahAlasan} onChange={e => setPindahAlasan(e.target.value)} placeholder="Mengikuti Orang Tua, dll." className="w-full border-gray-200 border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary bg-gray-50" />
                  </div>
                </>
              )}
              
              {currentTab === 'lulus' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tahun Ajaran</label>
                  <input type="text" value={lulusTahunAjaran} onChange={e => setLulusTahunAjaran(e.target.value)} placeholder="2023/2024" className="w-full border-gray-200 border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary bg-gray-50" />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tanggal Surat Dicetak</label>
                <input type="date" value={tglSurat} onChange={e => setTglSurat(e.target.value)} className="w-full border-gray-200 border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary bg-gray-50" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Preview Panel */}
        <div className="flex-1 overflow-y-auto bg-gray-200 p-4 lg:p-8 rounded-2xl border-4 border-dashed border-gray-300 flex items-start justify-center print:border-none print:bg-white print:p-0 print:overflow-visible">

          <style>{`
            @media print {
              html, body { 
                  height: auto !important; 
                  background-color: white !important; 
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
              }
              #printableArea {
                  position: absolute !important;
                  top: 0 !important;
                  left: 0 !important;
                  right: 0 !important;
                  margin: 0 auto !important;
              }
              @page { size: A4 portrait; margin: 0; }
            }
          `}</style>

          <div id="printableArea" className="w-[210mm] min-h-[297mm] bg-white shadow-xl mx-auto py-[1.5cm] px-[2cm] font-serif text-black relative">

            <div className="mb-6">
              <KopSurat dataLembaga={dataLembaga} />
            </div>

            {currentTab === 'penerimaan' ? (
              <div className="content">
                <div className="text-center mb-8">
                  <h2 className="text-lg font-bold underline decoration-2 uppercase">SURAT KETERANGAN PENERIMAAN</h2>
                  <p className="text-sm italic">Nomor : {noSurat || '........................'}</p>
                </div>
                <div className="space-y-4 text-[15px] leading-relaxed text-justify px-4">
                  <p className="indent-8">Yang bertanda tangan di bawah ini Kepala Sekolah {dataLembaga?.nama_lembaga || 'SMP IT Hidayatul Mubtadi-ien'}. Dengan ini menerangkan bahwa :</p>

                  <table className="w-full ml-12 mt-4">
                    <tbody>
                      <tr><td className="w-[35%] py-1">N a m a</td><td>: {selectedSiswa?.nama || '-'}</td></tr>
                      <tr><td className="py-1">Tempat, tanggal lahir</td><td>: {selectedSiswa?.tempat_lahir || '-'}, {renderTglLahirSiswa()}</td></tr>
                      <tr><td className="py-1">Kelas</td><td>: {renderKelasTingkat()}</td></tr>
                      <tr><td className="py-1">Sekolah Asal</td><td>: {penerimaanAsal || '............................................'}</td></tr>
                      <tr><td className="py-1">NISN</td><td>: {selectedSiswa?.nisn || '-'}</td></tr>
                    </tbody>
                  </table>

                  <p className="mt-4">Anak dari Orang Tua :</p>
                  <table className="w-full ml-12">
                    <tbody>
                      <tr><td className="w-[35%] py-1">Orang tua / Wali</td><td>: {renderOrtu()}</td></tr>
                      <tr><td className="py-1 align-top">Alamat</td><td className="align-top">: {renderAlamat()}</td></tr>
                    </tbody>
                  </table>

                  <p className="indent-8 mt-6">Telah diterima di SMP IT Hidayatul Mubtadi-ien pada tanggal {renderTglSuratFormatted()}. Dengan syarat melampirkan surat keterangan berkelakuan baik dari sekolah asal.</p>
                  <p className="indent-8 mt-4">Demikian surat keterangan penerimaan siswa pindahan ini dibuat, untuk dapat dipergunakan sebagaimana mestinya.</p>
                </div>
              </div>
            ) : currentTab === 'pindah' ? (
              <div className="content">
                <div className="text-center mb-8">
                  <h2 className="text-lg font-bold underline decoration-2 uppercase">SURAT KETERANGAN PINDAH SEKOLAH</h2>
                  <p className="text-sm">Nomor : {noSurat || '........................'}</p>
                </div>
                <div className="space-y-2 text-[15px] leading-relaxed text-justify px-4">
                  <p>Yang bertandatangan di bawah ini :</p>
                  <table className="w-full ml-12 mb-4">
                    <tbody>
                      <tr><td className="w-[35%] py-1">Nama</td><td>: <span className="font-bold">ABDUL MANAF, S.Pd</span></td></tr>
                      <tr><td className="py-1">NIP</td><td>: -</td></tr>
                      <tr><td className="py-1">Jabatan</td><td>: Kepala Sekolah</td></tr>
                      <tr><td className="py-1">Unit Kerja</td><td>: SMP IT Hidayatul Mubtadi-ien</td></tr>
                    </tbody>
                  </table>

                  <p>Dengan ini menerangkan bahwa :</p>
                  <table className="w-full ml-12 mb-4">
                    <tbody>
                      <tr><td className="w-[35%] py-1">Nama</td><td>: <span className="font-bold">{selectedSiswa?.nama || '-'}</span></td></tr>
                      <tr><td className="py-1">Tempat Tanggal Lahir</td><td>: {selectedSiswa?.tempat_lahir || '-'}, {renderTglLahirSiswa()}</td></tr>
                      <tr><td className="py-1">Kelas/Tingkat</td><td>: {renderKelasTingkat()}</td></tr>
                      <tr><td className="py-1">Nomor Induk Sekolah/NISN</td><td>: {selectedSiswa?.nipd || '-'} / {selectedSiswa?.nisn || '-'}</td></tr>
                      <tr><td className="py-1">Jenis Kelamin</td><td>: {selectedSiswa?.jenis_kelamin || '-'}</td></tr>
                      <tr><td className="py-1">Nama Orang Tua/Wali</td><td>: {renderOrtu()}</td></tr>
                    </tbody>
                  </table>

                  <p className="mt-4">Sesuai permohonan pindah ke <span className="font-bold uppercase">{pindahTujuan || '............................................'}</span> atas permintaan dari orang tua.</p>
                  <p className="mt-4">Demikian Surat Keterangan ini diberikan agar dapat dipergunakan sebagaimana mestinya.</p>
                </div>
              </div>
            ) : (
              <div className="content">
                <div className="text-center mb-8">
                  <h2 className="text-lg font-bold underline decoration-2 uppercase">SURAT KETERANGAN LULUS</h2>
                  <p className="text-sm">Nomor : {noSurat || '........................'}</p>
                </div>
                <div className="space-y-2 text-[15px] leading-relaxed text-justify px-4">
                  <p className="indent-8 mb-4">Yang bertanda tangan di bawah ini Kepala Sekolah SMP IT Hidayatul Mubtadi-ien, dengan ini menerangkan bahwa :</p>
                  <table className="w-full ml-12 mb-4">
                    <tbody>
                      <tr><td className="w-[35%] py-1">Nama Lengkap</td><td>: <span className="font-bold">{selectedSiswa?.nama || (daftarSiswaLulus[0]?.nama || '......................................')}</span></td></tr>
                      <tr><td className="py-1">Tempat, Tanggal Lahir</td><td>: {selectedSiswa?.tempat_lahir || (daftarSiswaLulus[0]?.tempat_lahir || '.....................')}, {selectedSiswa ? renderTglLahirSiswa() : (daftarSiswaLulus[0]?.tanggal_lahir || '.........................')}</td></tr>
                      <tr><td className="py-1">Nomor Induk Siswa</td><td>: {selectedSiswa?.nipd || (daftarSiswaLulus[0]?.nipd || '.....................')}</td></tr>
                      <tr><td className="py-1">NISN</td><td>: {selectedSiswa?.nisn || (daftarSiswaLulus[0]?.nisn || '.....................')}</td></tr>
                      <tr><td className="py-1">Kelas Terakhir</td><td>: {selectedSiswa ? renderKelasTingkat() : (filterKelas || 'IX (Sembilan)')}</td></tr>
                    </tbody>
                  </table>

                  <p className="mt-4 indent-8">Telah mengikuti serangkaian proses pembelajaran dan evaluasi. Berdasarkan hasil Keputusan Rapat Pleno Dewan Guru, siswa tersebut dinyatakan :</p>
                  
                  <div className="text-center my-8">
                     <span className="text-2xl font-bold border-[3px] border-black px-10 py-2 tracking-[0.3em]">LULUS</span>
                  </div>

                  <p className="mt-4 indent-8">dari SMP IT Hidayatul Mubtadi-ien pada Tahun Ajaran <span className="font-bold">{lulusTahunAjaran}</span>.</p>
                  <p className="mt-4 indent-8">Demikian Surat Keterangan Lulus ini dibuat dengan sesungguhnya untuk dapat dipergunakan sebagaimana mestinya.</p>
                </div>
              </div>
            )}

            {/* Tanda Tangan */}
            <div className="mt-12 flex justify-end">
              <div className="text-center w-[250px] text-[15px]">
                <p>Compreng, {renderTglSuratFormatted()}</p>
                <p>Kepala Sekolah,</p>
                <div className="h-24"></div>
                <p className="font-bold underline uppercase">{dataLembaga?.kepala_sekolah || 'ABDUL MANAF, S.Pd.'}</p>
                <p>NIP. {dataLembaga?.nip_kepsek || '-'}</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
