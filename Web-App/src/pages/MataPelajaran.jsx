import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { BookOpen, Plus, RefreshCw, Target } from 'lucide-react';
import Swal from 'sweetalert2';

export default function MataPelajaran() {
  const [dataMapel, setDataMapel] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_mapel')
        .select('*, kkm_mapel(kkm_akademik)')
        .order('urutan', { ascending: true });

      if (error) throw error;
      setDataMapel(data || []);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data mata pelajaran' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddMapel = () => {
    Swal.fire({
      title: 'Tambah Mata Pelajaran',
      html: `
        <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Nama Mapel</label>
            <input id="swal-input1" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" placeholder="Contoh: Matematika">
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Kode Mapel</label>
            <input id="swal-input2" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" placeholder="Contoh: MTK">
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Kelompok</label>
            <input id="swal-input3" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" placeholder="Contoh: A">
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Urutan</label>
            <input id="swal-input4" type="number" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" placeholder="Contoh: 1">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2a2c87',
      preConfirm: () => {
        return {
          nama_mapel: document.getElementById('swal-input1').value,
          kode_mapel: document.getElementById('swal-input2').value,
          kelompok: document.getElementById('swal-input3').value,
          urutan: document.getElementById('swal-input4').value ? parseInt(document.getElementById('swal-input4').value) : null
        }
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase
            .from('data_mapel')
            .insert([{
              nama_mapel: result.value.nama_mapel,
              kode_mapel: result.value.kode_mapel,
              kelompok: result.value.kelompok,
              urutan: result.value.urutan
            }]);
            
          if (error) throw error;
          
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Mata pelajaran baru telah ditambahkan.', timer: 1500, showConfirmButton: false });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: 'Terjadi kesalahan saat menambahkan data.' });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleDeleteMapel = (id) => {
    Swal.fire({
      title: 'Apakah Anda yakin?',
      text: "Data mata pelajaran ini akan dihapus permanen!",
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
            .from('data_mapel')
            .delete()
            .eq('id', id);
            
          if (error) throw error;
          
          Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Data mata pelajaran telah dihapus.', timer: 1500, showConfirmButton: false });
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

  const handleEditMapel = (item) => {
    Swal.fire({
      title: 'Edit Mata Pelajaran',
      html: `
        <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Nama Mapel</label>
            <input id="swal-input1" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" placeholder="Contoh: Matematika" value="${item.nama_mapel || ''}">
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Kode Mapel</label>
            <input id="swal-input2" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" placeholder="Contoh: MTK" value="${item.kode_mapel || ''}">
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Kelompok</label>
            <input id="swal-input3" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" placeholder="Contoh: A" value="${item.kelompok || ''}">
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Urutan</label>
            <input id="swal-input4" type="number" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" placeholder="Contoh: 1" value="${item.urutan || ''}">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#85c226',
      preConfirm: () => {
        return {
          nama_mapel: document.getElementById('swal-input1').value,
          kode_mapel: document.getElementById('swal-input2').value,
          kelompok: document.getElementById('swal-input3').value,
          urutan: document.getElementById('swal-input4').value ? parseInt(document.getElementById('swal-input4').value) : null
        }
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase
            .from('data_mapel')
            .update({
              nama_mapel: result.value.nama_mapel,
              kode_mapel: result.value.kode_mapel,
              kelompok: result.value.kelompok,
              urutan: result.value.urutan
            })
            .eq('id', item.id);
            
          if (error) throw error;
          
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data mata pelajaran telah diperbarui.', timer: 1500, showConfirmButton: false });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: 'Terjadi kesalahan saat memperbarui data.' });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleKKM = async (item) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('kkm_mapel')
        .select('*')
        .eq('id_mapel', item.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      const kkm = data || {};

      Swal.fire({
        title: `Atur KKM ${item.nama_mapel}`,
        html: `
          <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
            <div>
              <label style="font-size: 14px; font-weight: bold; color: #4b5563;">KKM Akademik</label>
              <input id="swal-kkm-akademik" type="number" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" value="${kkm.kkm_akademik || ''}">
            </div>
            <div>
              <label style="font-size: 14px; font-weight: bold; color: #4b5563;">KKM Akhlaq</label>
              <input id="swal-kkm-akhlaq" type="number" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" value="${kkm.kkm_akhlaq || ''}">
            </div>
            <div>
              <label style="font-size: 14px; font-weight: bold; color: #4b5563;">KKM Kerapihan</label>
              <input id="swal-kkm-kerapihan" type="number" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" value="${kkm.kkm_kerapihan || ''}">
            </div>
            <div>
              <label style="font-size: 14px; font-weight: bold; color: #4b5563;">KKM Keaktifan</label>
              <input id="swal-kkm-keaktifan" type="number" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" value="${kkm.kkm_keaktifan || ''}">
            </div>
            <div>
              <label style="font-size: 14px; font-weight: bold; color: #4b5563;">KKM Kedisiplinan</label>
              <input id="swal-kkm-kedisiplinan" type="number" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" value="${kkm.kkm_kedisiplinan || ''}">
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan KKM',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#0ea5e9',
        preConfirm: () => {
          return {
            id_mapel: item.id,
            kkm_akademik: document.getElementById('swal-kkm-akademik').value || null,
            kkm_akhlaq: document.getElementById('swal-kkm-akhlaq').value || null,
            kkm_kerapihan: document.getElementById('swal-kkm-kerapihan').value || null,
            kkm_keaktifan: document.getElementById('swal-kkm-keaktifan').value || null,
            kkm_kedisiplinan: document.getElementById('swal-kkm-kedisiplinan').value || null
          }
        }
      }).then(async (result) => {
        if (result.isConfirmed) {
          setIsLoading(true);
          try {
            if (kkm.id) {
              const { error: updateError } = await supabase
                .from('kkm_mapel')
                .update(result.value)
                .eq('id', kkm.id);
              if (updateError) throw updateError;
            } else {
              const { error: insertError } = await supabase
                .from('kkm_mapel')
                .insert([result.value]);
              if (insertError) throw insertError;
            }
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data KKM telah disimpan.', timer: 1500, showConfirmButton: false });
            fetchData();
          } catch (err) {
            console.error(err);
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat menyimpan KKM.' });
          } finally {
            setIsLoading(false);
          }
        }
      });
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat data KKM.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <BookOpen className="text-primary" /> Data Mata Pelajaran
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola daftar mata pelajaran kurikulum.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAddMapel} className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah Mapel
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
                <th className="px-6 py-4 text-center">Urutan</th>
                <th className="px-6 py-4">Nama Mapel</th>
                <th className="px-6 py-4">Kode Mapel</th>
                <th className="px-6 py-4">Kelompok</th>
                <th className="px-6 py-4">KKM Akademik</th>
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
              ) : dataMapel.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                    Tidak ada data mata pelajaran.
                  </td>
                </tr>
              ) : (
                dataMapel.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-center text-gray-600 font-semibold">{item.urutan || '-'}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{item.nama_mapel}</td>
                    <td className="px-6 py-4 text-gray-600">{item.kode_mapel || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{item.kelompok || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 font-semibold">{item.kkm_mapel && item.kkm_mapel.length > 0 ? item.kkm_mapel[0].kkm_akademik : '-'}</td>
                    <td className="px-6 py-4 text-center flex justify-center gap-2">
                      <button 
                        onClick={() => handleKKM(item)}
                        className="text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-md font-medium transition flex items-center gap-1 text-xs"
                      >
                        <Target size={14} /> KKM
                      </button>
                      <button 
                        onClick={() => handleEditMapel(item)}
                        className="text-yellow-600 hover:text-yellow-700 bg-yellow-50 px-2.5 py-1.5 rounded-md font-medium transition flex items-center gap-1 text-xs"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteMapel(item.id)}
                        className="text-red-600 hover:text-red-700 bg-red-50 px-2.5 py-1.5 rounded-md font-medium transition flex items-center gap-1 text-xs"
                      >
                        Hapus
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
