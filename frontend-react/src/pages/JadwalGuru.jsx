import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { CalendarDays, Plus, RefreshCw, Printer, Edit, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function JadwalGuru() {
  const [dataJadwal, setDataJadwal] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilterGuru, setSelectedFilterGuru] = useState('');

  // Reference data for dropdowns
  const [refKelas, setRefKelas] = useState([]);
  const [refMapel, setRefMapel] = useState([]);
  const [refGuru, setRefGuru] = useState([]);
  const [refPembelajaran, setRefPembelajaran] = useState([]);

  const fetchReferenceData = async () => {
    try {
      const [resKelas, resMapel, resGuru, resPembelajaran] = await Promise.all([
        supabase.from('data_kelas').select('id, nama_kelas, ruang_id').order('nama_kelas'),
        supabase.from('data_mapel').select('id, nama_mapel').order('urutan', { ascending: true }),
        supabase.from('data_guru').select('id, nama').is('tanggal_keluar', null).order('nama'),
        supabase.from('pembelajaran').select('kelas_id, mapel_id, guru_id')
      ]);
      if (resKelas.data) setRefKelas(resKelas.data);
      if (resMapel.data) setRefMapel(resMapel.data);
      if (resGuru.data) setRefGuru(resGuru.data);
      if (resPembelajaran.data) setRefPembelajaran(resPembelajaran.data);
    } catch (err) {
      console.error('Gagal mengambil referensi', err);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('jadwal_pelajaran')
        .select('*, data_kelas(nama_kelas, data_ruang(nama_ruang)), data_mapel(nama_mapel), data_guru(nama)')
        .order('hari', { ascending: true })
        .order('jam_ke', { ascending: true });

      if (error) throw error;
      setDataJadwal(data || []);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data jadwal pelajaran' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set default filter to logged in guru, unless Operator
    const checkRoleAndSetFilter = async () => {
      try {
        const storedUser = localStorage.getItem('user_guru');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          if (userData && userData.id) {
            const { data } = await supabase
              .from('jabatan_guru')
              .select('jabatan_utama')
              .eq('guru_id', userData.id)
              .maybeSingle();

            if (data && data.jabatan_utama && data.jabatan_utama.toLowerCase().includes('operator')) {
              setSelectedFilterGuru(''); // Operator melihat semua
            } else {
              setSelectedFilterGuru(userData.id.toString());
            }
          }
        }
      } catch (e) {
        console.error('Error parsing user_guru:', e);
      }
    };
    
    checkRoleAndSetFilter();
    fetchReferenceData();
    fetchData();
  }, []);

  const buildOptions = (items, keyLabel, selectedValue) => {
    return items.map(item => `<option value="${item.id}" ${item.id == selectedValue ? 'selected' : ''}>${item[keyLabel]}</option>`).join('');
  };

  const calculateWaktu = (jamKe) => {
    const jam = parseInt(jamKe);
    if (isNaN(jam)) return '';
    let startMinutes = 0;
    if (jam === 1) {
      startMinutes = 0;
    } else if (jam === 2) {
      startMinutes = 30;
    } else {
      startMinutes = 60 + (jam - 3) * 40;
    }
    const duration = (jam === 1 || jam === 2) ? 30 : 40;
    const endMinutes = startMinutes + duration;

    const formatTime = (totalMins) => {
      const hours = 7 + Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };
    return `${formatTime(startMinutes)} - ${formatTime(endMinutes)}`;
  };

  const handleAdd = () => {
    Swal.fire({
      title: 'Tambah Jadwal Mengajar',
      html: `
        <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Hari</label>
            <select id="swal-hari" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box; height: 45px;">
                <option value="Senin">Senin</option>
                <option value="Selasa">Selasa</option>
                <option value="Rabu">Rabu</option>
                <option value="Kamis">Kamis</option>
                <option value="Jumat">Jumat</option>
                <option value="Sabtu">Sabtu</option>
            </select>
          </div>
          <div style="display: flex; gap: 10px;">
            <div style="flex: 1;">
              <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Jam Ke-</label>
              <input id="swal-jam" type="number" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" placeholder="1, 2, 3...">
            </div>
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Kelas</label>
            <select id="swal-kelas" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box; height: 45px;">
                <option value="">-- Pilih Kelas --</option>
                ${buildOptions(refKelas, 'nama_kelas', null)}
            </select>
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Mata Pelajaran</label>
            <select id="swal-mapel" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box; height: 45px;">
                <option value="">-- Pilih Mapel --</option>
                ${buildOptions(refMapel, 'nama_mapel', null)}
            </select>
          </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
            <input type="checkbox" id="swal-istirahat" style="width: 20px; height: 20px;">
            <label style="font-size: 14px; font-weight: bold; color: #4b5563; margin:0;">Ini adalah Jam Istirahat?</label>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2a2c87',
      preConfirm: () => {
        const isIstirahat = document.getElementById('swal-istirahat').checked;
        const kelasId = document.getElementById('swal-kelas').value;
        const mapelId = document.getElementById('swal-mapel').value;

        let guruId = null;
        if (!isIstirahat) {
          if (!kelasId || !mapelId) {
            Swal.showValidationMessage('Untuk jam belajar, Kelas dan Mapel wajib diisi!');
            return false;
          }
          const pembel = refPembelajaran.find(p => p.kelas_id == kelasId && p.mapel_id == mapelId);
          if (pembel && pembel.guru_id) {
            guruId = pembel.guru_id;
          } else {
            Swal.showValidationMessage('Mata pelajaran ini belum diatur guru pengampunya di menu Data Pegawai (Pembelajaran)!');
            return false;
          }
        }

        const jamKe = document.getElementById('swal-jam').value;
        const hari = document.getElementById('swal-hari').value;

        if (!jamKe) {
          Swal.showValidationMessage('Jam Ke- wajib diisi!');
          return false;
        }

        if (isIstirahat) {
          const bentrokIstirahat = dataJadwal.find(j => j.hari === hari && j.jam_ke == jamKe && j.is_istirahat);
          if (bentrokIstirahat) {
            Swal.showValidationMessage(`Sudah ada jam istirahat pada hari ${hari} jam ke-${jamKe}!`);
            return false;
          }
        } else {
          const bentrokGuru = dataJadwal.find(j => j.hari === hari && j.jam_ke == jamKe && j.guru_id == guruId && !j.is_istirahat);
          if (bentrokGuru) {
            Swal.showValidationMessage(`Guru ${bentrokGuru.data_guru?.nama || 'tersebut'} sudah ada jadwal mengajar di kelas ${bentrokGuru.data_kelas?.nama_kelas || 'lain'} pada hari dan jam tersebut!`);
            return false;
          }

          const bentrokKelas = dataJadwal.find(j => j.hari === hari && j.jam_ke == jamKe && j.kelas_id == kelasId && !j.is_istirahat);
          if (bentrokKelas) {
            Swal.showValidationMessage(`Kelas tersebut sudah ada jadwal mapel ${bentrokKelas.data_mapel?.nama_mapel || 'lain'} pada hari dan jam tersebut!`);
            return false;
          }
        }

        let ruangId = null;
        if (kelasId) {
          const selectedKelas = refKelas.find(k => k.id == kelasId);
          if (selectedKelas && selectedKelas.ruang_id) {
            ruangId = selectedKelas.ruang_id;
          }
        }

        return {
          hari: hari,
          jam_ke: jamKe,
          waktu: calculateWaktu(jamKe),
          kelas_id: isIstirahat || !kelasId ? null : parseInt(kelasId),
          mapel_id: isIstirahat || !mapelId ? null : parseInt(mapelId),
          guru_id: isIstirahat || !guruId ? null : parseInt(guruId),
          ruang_id: isIstirahat ? null : ruangId,
          is_istirahat: isIstirahat
        }
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase
            .from('jadwal_pelajaran')
            .insert([result.value]);
            
          if (error) throw error;
          
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Jadwal baru telah ditambahkan.', timer: 1500, showConfirmButton: false });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat menambahkan data.' });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleEdit = (item) => {
    Swal.fire({
      title: 'Edit Jadwal Mengajar',
      html: `
        <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Hari</label>
            <select id="swal-hari" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box; height: 45px;">
                <option value="Senin" ${item.hari === 'Senin' ? 'selected' : ''}>Senin</option>
                <option value="Selasa" ${item.hari === 'Selasa' ? 'selected' : ''}>Selasa</option>
                <option value="Rabu" ${item.hari === 'Rabu' ? 'selected' : ''}>Rabu</option>
                <option value="Kamis" ${item.hari === 'Kamis' ? 'selected' : ''}>Kamis</option>
                <option value="Jumat" ${item.hari === 'Jumat' ? 'selected' : ''}>Jumat</option>
                <option value="Sabtu" ${item.hari === 'Sabtu' ? 'selected' : ''}>Sabtu</option>
            </select>
          </div>
          <div style="display: flex; gap: 10px;">
            <div style="flex: 1;">
              <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Jam Ke-</label>
              <input id="swal-jam" type="number" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" value="${item.jam_ke || ''}">
            </div>
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Kelas</label>
            <select id="swal-kelas" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box; height: 45px;">
                <option value="">-- Pilih Kelas --</option>
                ${buildOptions(refKelas, 'nama_kelas', item.kelas_id)}
            </select>
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Mata Pelajaran</label>
            <select id="swal-mapel" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box; height: 45px;">
                <option value="">-- Pilih Mapel --</option>
                ${buildOptions(refMapel, 'nama_mapel', item.mapel_id)}
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
            <input type="checkbox" id="swal-istirahat" style="width: 20px; height: 20px;" ${item.is_istirahat ? 'checked' : ''}>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563; margin:0;">Ini adalah Jam Istirahat?</label>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Simpan Perubahan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#85c226',
      preConfirm: () => {
        const isIstirahat = document.getElementById('swal-istirahat').checked;
        const kelasId = document.getElementById('swal-kelas').value;
        const mapelId = document.getElementById('swal-mapel').value;

        let guruId = null;
        if (!isIstirahat) {
          if (!kelasId || !mapelId) {
            Swal.showValidationMessage('Untuk jam belajar, Kelas dan Mapel wajib diisi!');
            return false;
          }
          const pembel = refPembelajaran.find(p => p.kelas_id == kelasId && p.mapel_id == mapelId);
          if (pembel && pembel.guru_id) {
            guruId = pembel.guru_id;
          } else {
            Swal.showValidationMessage('Mata pelajaran ini belum diatur guru pengampunya di menu Data Pegawai (Pembelajaran)!');
            return false;
          }
        }

        const jamKe = document.getElementById('swal-jam').value;
        const hari = document.getElementById('swal-hari').value;

        if (!jamKe) {
          Swal.showValidationMessage('Jam Ke- wajib diisi!');
          return false;
        }

        if (isIstirahat) {
          const bentrokIstirahat = dataJadwal.find(j => j.hari === hari && j.jam_ke == jamKe && j.is_istirahat && j.id !== item.id);
          if (bentrokIstirahat) {
            Swal.showValidationMessage(`Sudah ada jam istirahat pada hari ${hari} jam ke-${jamKe}!`);
            return false;
          }
        } else {
          const bentrokGuru = dataJadwal.find(j => j.hari === hari && j.jam_ke == jamKe && j.guru_id == guruId && !j.is_istirahat && j.id !== item.id);
          if (bentrokGuru) {
            Swal.showValidationMessage(`Guru ${bentrokGuru.data_guru?.nama || 'tersebut'} sudah ada jadwal mengajar di kelas ${bentrokGuru.data_kelas?.nama_kelas || 'lain'} pada hari dan jam tersebut!`);
            return false;
          }

          const bentrokKelas = dataJadwal.find(j => j.hari === hari && j.jam_ke == jamKe && j.kelas_id == kelasId && !j.is_istirahat && j.id !== item.id);
          if (bentrokKelas) {
            Swal.showValidationMessage(`Kelas tersebut sudah ada jadwal mapel ${bentrokKelas.data_mapel?.nama_mapel || 'lain'} pada hari dan jam tersebut!`);
            return false;
          }
        }

        let ruangId = null;
        if (kelasId) {
          const selectedKelas = refKelas.find(k => k.id == kelasId);
          if (selectedKelas && selectedKelas.ruang_id) {
            ruangId = selectedKelas.ruang_id;
          }
        }

        return {
          hari: hari,
          jam_ke: jamKe,
          waktu: calculateWaktu(jamKe),
          kelas_id: isIstirahat || !kelasId ? null : parseInt(kelasId),
          mapel_id: isIstirahat || !mapelId ? null : parseInt(mapelId),
          guru_id: isIstirahat || !guruId ? null : parseInt(guruId),
          ruang_id: isIstirahat ? null : ruangId,
          is_istirahat: isIstirahat
        }
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase
            .from('jadwal_pelajaran')
            .update(result.value)
            .eq('id', item.id);
            
          if (error) throw error;
          
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data jadwal telah diperbarui.', timer: 1500, showConfirmButton: false });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat memperbarui data.' });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleDelete = (id) => {
    Swal.fire({
      title: 'Apakah Anda yakin?',
      text: "Data jadwal ini akan dihapus permanen!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase
            .from('jadwal_pelajaran')
            .delete()
            .eq('id', id);
            
          if (error) throw error;
          
          Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Data jadwal telah dihapus.', timer: 1500, showConfirmButton: false });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: 'Terjadi kesalahan saat menghapus data.' });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <CalendarDays className="text-primary" /> Jadwal Mengajar
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola jadwal pelajaran dan plotting guru pengampu.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
             <label className="text-xs font-bold text-gray-500 uppercase">Filter Guru:</label>
             <select 
               value={selectedFilterGuru}
               onChange={(e) => setSelectedFilterGuru(e.target.value)}
               className="text-sm font-semibold bg-transparent outline-none text-gray-700"
             >
               <option value="">Semua Guru (Tampilkan Semua)</option>
               {refGuru.map(g => (
                 <option key={g.id} value={g.id}>{g.nama}</option>
               ))}
             </select>
          </div>
          <button onClick={handleAdd} className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah Jadwal
          </button>
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
            <Printer size={16} /> Cetak Jadwal
          </button>
          <button onClick={fetchData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Hari & Jam</th>
                <th className="px-6 py-4">Kelas</th>
                <th className="px-6 py-4">Mata Pelajaran</th>
                <th className="px-6 py-4">Guru Pengampu</th>
                <th className="px-6 py-4">Ruang</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : dataJadwal.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                    Belum ada data jadwal mengajar.
                  </td>
                </tr>
              ) : (() => {
                const filteredJadwal = selectedFilterGuru 
                  ? dataJadwal.filter(j => j.is_istirahat || j.guru_id == selectedFilterGuru) 
                  : dataJadwal;
                  
                if (filteredJadwal.length === 0) {
                  return (
                    <tr>
                      <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                        Tidak ada jadwal untuk guru yang dipilih.
                      </td>
                    </tr>
                  );
                }

                return filteredJadwal.map((item, idx) => (
                  <tr key={idx} className={"hover:bg-gray-50 transition " + (item.is_istirahat ? "bg-orange-50/50" : "")}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{item.hari}</div>
                      <div className="text-xs text-gray-500">Jam ke-{item.jam_ke} ({item.waktu})</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">
                        {item.is_istirahat ? <span className="text-orange-500 font-semibold italic">ISTIRAHAT</span> : (item.data_kelas?.nama_kelas || '-')}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                        {item.is_istirahat ? '-' : (item.data_mapel?.nama_mapel || '-')}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                        {item.is_istirahat ? '-' : (item.data_guru?.nama || '-')}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{item.data_kelas?.data_ruang?.nama_ruang || '-'}</td>
                    <td className="px-6 py-4 text-center flex justify-center gap-2">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="text-yellow-600 hover:text-yellow-700 bg-yellow-50 px-2.5 py-1.5 rounded-md font-medium transition flex items-center gap-1 text-xs"
                      >
                        <Edit size={14} /> Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-700 bg-red-50 px-2.5 py-1.5 rounded-md font-medium transition flex items-center gap-1 text-xs"
                      >
                        <Trash2 size={14} /> Hapus
                      </button>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
