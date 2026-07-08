import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle, XCircle, Clock, Search, Plus, RefreshCw, FileSignature, Edit, Trash2, Save, FileDown, Printer } from 'lucide-react';
import Swal from 'sweetalert2';

export default function VerifikasiPPDB() {
  const [dataPendaftar, setDataPendaftar] = useState([]);
  const [dataKelas, setDataKelas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    lengkap: 0,
    kurang: 0,
    belum: 0
  });

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editCeklis, setEditCeklis] = useState({
    formulir: false, ijazah: false, pindah: false, kk: false,
    akta: false, rapor: false, ktp: false, foto: false, pip: false
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resPendaftar, resKelas] = await Promise.all([
        supabase.from('ppdb_pendaftar').select('*').order('created_at', { ascending: false }),
        supabase.from('data_kelas').select('*').order('nama_kelas', { ascending: true })
      ]);

      if (resPendaftar.error) throw resPendaftar.error;
      const processedData = resPendaftar.data;

      setDataPendaftar(processedData || []);
      setDataKelas(resKelas.data || []);
      
      // Calculate stats
      const lengkap = processedData.filter(d => d.status_berkas === 'Lengkap').length;
      const kurang = processedData.filter(d => d.status_berkas === 'Kurang').length;
      const belum = processedData.filter(d => d.status_berkas === 'Belum Verifikasi').length;
      
      setStats({
        total: processedData.length,
        lengkap,
        kurang,
        belum
      });
      
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data pendaftar' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTerimaSiswa = async (item) => {
    if (item.status_berkas !== 'Lengkap') {
      Swal.fire({
        icon: 'warning',
        title: 'Berkas Belum Lengkap',
        text: 'Pastikan berkas fisik calon siswa sudah lengkap sebelum diterima menjadi siswa aktif.'
      });
      return;
    }

    const kelasOptions = dataKelas.map(k => `<option value="${k.nama_kelas}">${k.nama_kelas}</option>`).join('');

    const result = await Swal.fire({
      title: 'Terima Calon Siswa?',
      html: `
        <div style="text-align: left;">
          <p style="margin-bottom: 15px;">Anda akan menerima <b>${item.nama}</b> sebagai siswa aktif.</p>
          
          <label style="font-size: 14px; font-weight: bold; color: #4b5563;">NIPD (Nomor Induk Peserta Didik)</label>
          <input id="swal-nipd-siswa" class="swal2-input" placeholder="Masukkan NIPD..." style="margin: 5px 0 15px 0; width: 100%; box-sizing: border-box; height: 45px;">

          <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Pilih Kelas / Rombel</label>
          <select id="swal-kelas-siswa" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box; height: 45px;">
            <option value="">-- Pilih Kelas --</option>
            ${kelasOptions}
          </select>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Terima Siswa!',
      preConfirm: () => {
        const selectedKelas = document.getElementById('swal-kelas-siswa').value;
        const nipd = document.getElementById('swal-nipd-siswa').value;
        if (!nipd) {
          Swal.showValidationMessage('NIPD harus diisi!');
          return false;
        }
        if (!selectedKelas) {
          Swal.showValidationMessage('Anda harus memilih kelas untuk siswa ini');
          return false;
        }
        return { kelas: selectedKelas, nipd: nipd };
      }
    });

    if (result.isConfirmed) {
      try {
        const payloadSiswa = {
          nipd: result.value.nipd,
          nik: item.nik,
          nisn: item.nisn,
          nama: item.nama,
          tempat_lahir: item.tempat_lahir,
          tanggal_lahir: item.tanggal_lahir,
          jenis_kelamin: item.jenis_kelamin,
          alamat_detail: item.alamat_detail,
          rt: item.rt,
          rw: item.rw,
          desa: item.desa,
          kecamatan: item.kecamatan,
          kabupaten: item.kabupaten,
          provinsi: item.provinsi,
          wa_siswa: item.wa_siswa,
          wa_ortu: item.wa_ortu,
          kelas: result.value.kelas,
          angkatan: item.angkatan,
          tahun_ajaran: item.tahun_ajaran,
          tanggal_masuk: item.tanggal_masuk,
          status_siswa: item.status_siswa,
          sekolah_asal: item.sekolah_asal,
          nama_ayah: item.nama_ayah,
          nama_ibu: item.nama_ibu,
          nama_wali: item.nama_wali,
          foto_url: item.foto_url,
          status_keaktifan: 'Aktif'
        };

        const { error: insertErr } = await supabase
          .from('data_siswa')
          .insert([payloadSiswa]);

        if (insertErr) throw insertErr;

        // Setelah berhasil masuk ke data_siswa, hapus dari ppdb_pendaftar
        const { error: deleteErr } = await supabase
          .from('ppdb_pendaftar')
          .delete()
          .eq('id', item.id);
          
        if (deleteErr) throw deleteErr;

        Swal.fire('Berhasil!', `${item.nama} resmi menjadi siswa.`, 'success');
        fetchData();
      } catch (err) {
        console.error(err);
        Swal.fire('Gagal', err.message || 'Terjadi kesalahan saat menerima siswa.', 'error');
      }
    }
  };

  const handleDelete = async (id, nama) => {
    const result = await Swal.fire({
      title: 'Hapus Data?',
      text: `Anda yakin ingin menghapus data pendaftaran ${nama}? Tindakan ini tidak dapat dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from('ppdb_pendaftar').delete().eq('id', id);
        if (error) throw error;
        Swal.fire('Terhapus!', 'Data pendaftar telah dihapus.', 'success');
        fetchData();
      } catch (err) {
        console.error(err);
        Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus data.', 'error');
      }
    }
  };

  const openEditModal = (item) => {
    setSelectedItem(item);
    setEditCeklis({
      formulir: item.ceklis_formulir === 'Ada',
      ijazah: item.ceklis_ijazah === 'Ada',
      pindah: item.ceklis_pindah === 'Ada',
      kk: item.ceklis_kk === 'Ada',
      akta: item.ceklis_akta === 'Ada',
      rapor: item.ceklis_rapor === 'Ada',
      ktp: item.ceklis_ktp === 'Ada',
      foto: item.ceklis_foto === 'Ada',
      pip: item.ceklis_pip === 'Ada'
    });
    setIsModalOpen(true);
  };

  const handleCeklisChange = (e) => {
    const { name, checked } = e.target;
    setEditCeklis(prev => ({ ...prev, [name]: checked }));
  };

  const saveVerifikasi = async () => {
    setIsLoading(true);
    try {
      const isLengkap = editCeklis.formulir && (editCeklis.ijazah || editCeklis.pindah) && editCeklis.kk && editCeklis.akta;
      const kesimpulanStatus = isLengkap ? "Lengkap" : "Kurang";

      const payload = {
        status_berkas: kesimpulanStatus,
        ceklis_formulir: editCeklis.formulir ? "Ada" : "Tidak",
        ceklis_ijazah: editCeklis.ijazah ? "Ada" : "Tidak",
        ceklis_pindah: editCeklis.pindah ? "Ada" : "Tidak",
        ceklis_kk: editCeklis.kk ? "Ada" : "Tidak",
        ceklis_akta: editCeklis.akta ? "Ada" : "Tidak",
        ceklis_rapor: editCeklis.rapor ? "Ada" : "Tidak",
        ceklis_ktp: editCeklis.ktp ? "Ada" : "Tidak",
        ceklis_foto: editCeklis.foto ? "Ada" : "Tidak",
        ceklis_pip: editCeklis.pip ? "Ada" : "Tidak"
      };

      const { error } = await supabase.from('ppdb_pendaftar').update(payload).eq('id', selectedItem.id);
      if (error) throw error;

      Swal.fire('Tersimpan', 'Verifikasi berkas berhasil diperbarui.', 'success');
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire('Gagal', 'Terjadi kesalahan saat menyimpan verifikasi.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (typeof window.XLSX === 'undefined') {
      Swal.fire('Error', 'Library Excel (XLSX) gagal dimuat. Pastikan Anda terhubung ke internet.', 'error');
      return;
    }

    if (dataPendaftar.length === 0) {
      Swal.fire('Kosong', 'Tidak ada data pendaftar untuk diekspor.', 'warning');
      return;
    }

    const excelData = dataPendaftar.map((p, index) => ({
      'No': index + 1,
      'Nama Calon Siswa': p.nama,
      'NIK': p.nik || '-',
      'NISN': p.nisn || '-',
      'Jenis Kelamin': p.jenis_kelamin === 'L' ? 'Laki-laki' : p.jenis_kelamin === 'P' ? 'Perempuan' : p.jenis_kelamin,
      'Tanggal Lahir': p.tanggal_lahir,
      'Asal Sekolah': p.sekolah_asal || '-',
      'Nama Ayah': p.nama_ayah || '-',
      'Nama Ibu': p.nama_ibu || '-',
      'No. WA Ortu': p.wa_ortu || '-',
      'Tanggal Daftar': new Date(p.created_at).toLocaleDateString('id-ID'),
      'Status Verifikasi': p.status_berkas || 'Belum Verifikasi',
      'Formulir': p.ceklis_formulir || 'Tidak',
      'Ijazah/SKL': p.ceklis_ijazah || 'Tidak',
      'Srt Pindah': p.ceklis_pindah || 'Tidak',
      'Kartu Keluarga': p.ceklis_kk || 'Tidak',
      'Akta Kelahiran': p.ceklis_akta || 'Tidak',
      'Rapor': p.ceklis_rapor || 'Tidak',
      'KTP Ortu': p.ceklis_ktp || 'Tidak',
      'Pas Foto': p.ceklis_foto || 'Tidak',
      'KIP/PIP': p.ceklis_pip || 'Tidak'
    }));

    const worksheet = window.XLSX.utils.json_to_sheet(excelData);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Data Pendaftar PPDB");
    window.XLSX.writeFile(workbook, "Verifikasi_Berkas_PPDB.xlsx");
  };

  const handleCetak = () => {
    window.print();
  };

  const filteredData = dataPendaftar.filter(item => 
    item.nama?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.nisn?.includes(searchTerm)
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <FileSignature className="text-primary" /> Verifikasi Berkas Fisik
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola dan pastikan kelengkapan dokumen siswa baru & pindahan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/admin/pendaftaran-spmb')} className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm print:hidden">
            <Plus size={16} /> Tambah Pendaftar
          </button>
          <button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm print:hidden">
            <FileDown size={16} /> Export
          </button>
          <button onClick={handleCetak} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm print:hidden">
            <Printer size={16} /> Cetak
          </button>
          <button onClick={fetchData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm print:hidden">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500 flex justify-between items-center transition hover:shadow-md">
          <div>
            <p className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total Pendaftar</p>
            <h3 className="text-2xl md:text-3xl font-bold text-gray-800">{stats.total}</h3>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
            <Users />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500 flex justify-between items-center transition hover:shadow-md">
          <div>
            <p className="text-[10px] md:text-xs text-green-600 font-bold uppercase tracking-wider mb-1">Sudah Lengkap</p>
            <h3 className="text-2xl md:text-3xl font-bold text-gray-800">{stats.lengkap}</h3>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-50 flex items-center justify-center text-green-500 shrink-0">
            <CheckCircle />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500 flex justify-between items-center transition hover:shadow-md">
          <div>
            <p className="text-[10px] md:text-xs text-red-600 font-bold uppercase tracking-wider mb-1">Belum Lengkap</p>
            <h3 className="text-2xl md:text-3xl font-bold text-gray-800">{stats.kurang}</h3>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
            <XCircle />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow-400 flex justify-between items-center transition hover:shadow-md">
          <div>
            <p className="text-[10px] md:text-xs text-yellow-600 font-bold uppercase tracking-wider mb-1">Belum Verifikasi</p>
            <h3 className="text-2xl md:text-3xl font-bold text-gray-800">{stats.belum}</h3>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600 shrink-0">
            <Clock />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama calon siswa..." 
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:bg-white outline-none text-sm font-medium transition text-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Nama Lengkap & NISN</th>
                <th className="px-6 py-4">Asal Sekolah</th>
                <th className="px-3 py-4 text-center" title="Formulir Pendaftaran">FMR</th>
                <th className="px-3 py-4 text-center" title="Ijazah / SKL">IJZ</th>
                <th className="px-3 py-4 text-center" title="Surat Pindah">PND</th>
                <th className="px-3 py-4 text-center" title="Kartu Keluarga">KK</th>
                <th className="px-3 py-4 text-center" title="Akta Kelahiran">AKT</th>
                <th className="px-3 py-4 text-center" title="Rapor">RPR</th>
                <th className="px-3 py-4 text-center" title="KTP Orang Tua">KTP</th>
                <th className="px-3 py-4 text-center" title="Pas Foto">FTO</th>
                <th className="px-3 py-4 text-center" title="KIP / PIP / KKS">PIP</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="13" className="px-6 py-10 text-center text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="13" className="px-6 py-10 text-center text-gray-400">
                    Tidak ada data pendaftar.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{item.nama}</div>
                      <div className="text-xs text-gray-500">{item.nisn}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{item.sekolah_asal}</td>
                    <td className="px-3 py-4 text-center">{item.ceklis_formulir === 'Ada' ? '✅' : '❌'}</td>
                    <td className="px-3 py-4 text-center">{item.ceklis_ijazah === 'Ada' ? '✅' : '❌'}</td>
                    <td className="px-3 py-4 text-center">{item.ceklis_pindah === 'Ada' ? '✅' : '❌'}</td>
                    <td className="px-3 py-4 text-center">{item.ceklis_kk === 'Ada' ? '✅' : '❌'}</td>
                    <td className="px-3 py-4 text-center">{item.ceklis_akta === 'Ada' ? '✅' : '❌'}</td>
                    <td className="px-3 py-4 text-center">{item.ceklis_rapor === 'Ada' ? '✅' : '❌'}</td>
                    <td className="px-3 py-4 text-center">{item.ceklis_ktp === 'Ada' ? '✅' : '❌'}</td>
                    <td className="px-3 py-4 text-center">{item.ceklis_foto === 'Ada' ? '✅' : '❌'}</td>
                    <td className="px-3 py-4 text-center">{item.ceklis_pip === 'Ada' ? '✅' : '❌'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        item.status_berkas === 'Lengkap' ? 'bg-green-100 text-green-700' :
                        item.status_berkas === 'Kurang' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {item.status_berkas}
                      </span>
                    </td>
                    <td className="px-6 py-4 print:hidden">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditModal(item)} className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-2.5 py-1.5 rounded-md hover:bg-blue-100 transition flex items-center gap-1 text-xs" title="Verifikasi Ulang">
                          <Edit size={14} /> Verif
                        </button>
                        
                        {item.status_berkas === 'Lengkap' && (
                          <button onClick={() => handleTerimaSiswa(item)} className="text-green-600 hover:text-green-800 font-medium bg-green-50 px-2.5 py-1.5 rounded-md hover:bg-green-100 transition flex items-center gap-1 text-xs" title="Terima sebagai Siswa Aktif">
                            <CheckCircle size={14} /> Terima
                          </button>
                        )}

                        <button onClick={() => handleDelete(item.id, item.nama)} className="text-red-600 hover:text-red-800 font-medium bg-red-50 px-2.5 py-1.5 rounded-md hover:bg-red-100 transition flex items-center gap-1 text-xs" title="Hapus Data">
                          <Trash2 size={14} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-gray-800">Verifikasi Berkas Susulan</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-sm text-gray-500 mb-4">Centang dokumen yang diserahkan oleh <strong>{selectedItem.nama}</strong>:</p>
              
              <div className="space-y-3">
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" name="formulir" checked={editCeklis.formulir} onChange={handleCeklisChange} className="w-5 h-5 text-primary rounded focus:ring-primary" />
                  <span className="text-sm font-medium">Formulir Pendaftaran <span className="text-red-500">*</span></span>
                </label>
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" name="ijazah" checked={editCeklis.ijazah} onChange={handleCeklisChange} className="w-5 h-5 text-primary rounded focus:ring-primary" />
                  <span className="text-sm font-medium">Ijazah / SKL <span className="text-red-500">*</span></span>
                </label>
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" name="pindah" checked={editCeklis.pindah} onChange={handleCeklisChange} className="w-5 h-5 text-primary rounded focus:ring-primary" />
                  <span className="text-sm font-medium">Surat Pindah Mutasi <span className="text-red-500">*</span></span>
                </label>
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" name="kk" checked={editCeklis.kk} onChange={handleCeklisChange} className="w-5 h-5 text-primary rounded focus:ring-primary" />
                  <span className="text-sm font-medium">FC Kartu Keluarga <span className="text-red-500">*</span></span>
                </label>
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" name="akta" checked={editCeklis.akta} onChange={handleCeklisChange} className="w-5 h-5 text-primary rounded focus:ring-primary" />
                  <span className="text-sm font-medium">FC Akta Kelahiran <span className="text-red-500">*</span></span>
                </label>
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" name="rapor" checked={editCeklis.rapor} onChange={handleCeklisChange} className="w-5 h-5 text-primary rounded focus:ring-primary" />
                  <span className="text-sm font-medium">Rapor Sekolah</span>
                </label>
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" name="ktp" checked={editCeklis.ktp} onChange={handleCeklisChange} className="w-5 h-5 text-primary rounded focus:ring-primary" />
                  <span className="text-sm font-medium">FC KTP Orang Tua</span>
                </label>
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" name="foto" checked={editCeklis.foto} onChange={handleCeklisChange} className="w-5 h-5 text-primary rounded focus:ring-primary" />
                  <span className="text-sm font-medium">Pas Foto 3x4</span>
                </label>
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" name="pip" checked={editCeklis.pip} onChange={handleCeklisChange} className="w-5 h-5 text-primary rounded focus:ring-primary" />
                  <span className="text-sm font-medium">Buku/Kartu PIP</span>
                </label>
              </div>
            </div>
            
            <div className="p-4 border-t shrink-0">
              <button onClick={saveVerifikasi} disabled={isLoading} className="w-full bg-primary hover:bg-blue-900 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50">
                {isLoading ? 'Menyimpan...' : <><Save size={18} /> Simpan Perubahan</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
