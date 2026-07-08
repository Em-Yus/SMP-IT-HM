import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Clock, Search, Save, Calendar, CheckCircle, XCircle, AlertCircle, RefreshCw, Download, UserCheck, FileText } from 'lucide-react';
import Swal from 'sweetalert2';

export default function PresensiGuru() {
  const [currentTab, setCurrentTab] = useState('saya'); // 'saya' | 'rekap'
  const [currentUser, setCurrentUser] = useState(null);
  const [isOperator, setIsOperator] = useState(false);

  // ==== STATE PRESENSI SAYA ====
  const [myPresensi, setMyPresensi] = useState({
    id: null,
    status: 'Hadir',
    waktu_datang: '',
    waktu_pulang: '',
    keterangan: ''
  });
  const [isSavingMy, setIsSavingMy] = useState(false);
  const [isMyLoading, setIsMyLoading] = useState(true);

  // ==== STATE REKAP OPERATOR ====
  const [pegawai, setPegawai] = useState([]);
  const [presensiMap, setPresensiMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const userStr = localStorage.getItem('user_guru');
    if (userStr) {
      const u = JSON.parse(userStr);
      setCurrentUser(u);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      checkRole();
      if (currentTab === 'saya') {
        fetchMyPresensi();
      } else {
        fetchRekapData();
      }
    }
  }, [currentTab, tanggal, currentUser]);

  const checkRole = async () => {
    try {
      const { data } = await supabase.from('jabatan_guru').select('*').eq('guru_id', currentUser.id).maybeSingle();
      if (data) {
        const roles = [data.jabatan_utama, data.jabatan_lain_1, data.jabatan_lain_2, data.jabatan_lain_3].filter(Boolean);
        const hasOperator = roles.some(r => r.toLowerCase().includes('operator') || r.toLowerCase().includes('admin') || r.toLowerCase().includes('kepala sekolah'));
        setIsOperator(hasOperator);
      }
    } catch (e) {
      console.error('Error checking role:', e);
    }
  };

  // ==============================
  // LOGIKA PRESENSI SAYA
  // ==============================
  const fetchMyPresensi = async () => {
    setIsMyLoading(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data, error } = await supabase
        .from('presensi_guru')
        .select('*')
        .eq('guru_id', currentUser.id)
        .eq('tanggal', today)
        .maybeSingle();

      if (error && error.code === '42P01') {
        Swal.fire('Perhatian', 'Tabel presensi_guru belum dibuat di database.', 'warning');
        return;
      }

      if (data) {
        setMyPresensi({
          id: data.id,
          status: data.status,
          waktu_datang: data.waktu_datang || '',
          waktu_pulang: data.waktu_pulang || '',
          keterangan: data.alasan || ''
        });
      } else {
        // Default empty state for today
        setMyPresensi({
          id: null,
          status: '', // Kosongkan agar bisa memilih
          waktu_datang: '',
          waktu_pulang: '',
          keterangan: ''
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsMyLoading(false);
    }
  };

  const handleSimpanMyPresensi = async (overrideData = null) => {
    setIsSavingMy(true);
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

    try {
      const today = new Date().toISOString().split('T')[0];
      const dataToSave = overrideData || myPresensi;

      const payload = {
        id: dataToSave.id || undefined,
        guru_id: currentUser.id,
        tanggal: today,
        status: dataToSave.status,
        waktu_datang: dataToSave.status === 'Hadir' ? (dataToSave.waktu_datang || null) : null,
        waktu_pulang: dataToSave.status === 'Hadir' ? (dataToSave.waktu_pulang || null) : null,
        alasan: dataToSave.keterangan || null
      };

      const { data, error } = await supabase.from('presensi_guru').upsert(payload, { onConflict: 'id' }).select().single();

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Presensi Anda hari ini berhasil disimpan.`,
        timer: 1500,
        showConfirmButton: false
      });

      // Update state dengan data yang baru disimpan
      if (data) {
        setMyPresensi({
          id: data.id,
          status: data.status,
          waktu_datang: data.waktu_datang || '',
          waktu_pulang: data.waktu_pulang || '',
          keterangan: data.alasan || ''
        });
      } else {
        fetchMyPresensi();
      }

    } catch (e) {
      console.error(e);
      Swal.fire('Error', e.message || 'Gagal menyimpan data presensi.', 'error');
    } finally {
      setIsSavingMy(false);
    }
  };

  const handleActionHadir = () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newData = { ...myPresensi, status: 'Hadir', waktu_datang: currentTime };
    handleSimpanMyPresensi(newData);
  };

  const handleActionPulang = () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newData = { ...myPresensi, waktu_pulang: currentTime };
    handleSimpanMyPresensi(newData);
  };

  // ==============================
  // LOGIKA REKAP OPERATOR
  // ==============================
  const fetchRekapData = async () => {
    setIsLoading(true);
    try {
      const { data: dataPegawai, error: errPegawai } = await supabase
        .from('data_guru')
        .select('id, nama')
        .is('tanggal_keluar', null)
        .order('nama');

      if (errPegawai) throw errPegawai;
      setPegawai(dataPegawai || []);

      const { data: dataPresensi, error: errPresensi } = await supabase
        .from('presensi_guru')
        .select('*')
        .eq('tanggal', tanggal);

      if (errPresensi && errPresensi.code !== '42P01') {
        throw errPresensi;
      }

      const map = {};
      if (dataPresensi) {
        dataPresensi.forEach(p => {
          map[p.guru_id] = p;
        });
      }

      setPresensiMap(map);

    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal memuat rekap presensi.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (pegawai.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nama Pegawai,Status,Jam Datang,Jam Pulang,Keterangan\n";

    pegawai.forEach(peg => {
      const p = presensiMap[peg.id];
      const status = p?.status || 'Belum Absen';
      const datang = p?.waktu_datang || '-';
      const pulang = p?.waktu_pulang || '-';
      const ket = p?.alasan || '-';

      const row = `"${peg.nama}","${status}","${datang}","${pulang}","${ket}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Presensi_${tanggal}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==============================
  // RENDER HELPERS
  // ==============================
  const filteredPegawai = pegawai.filter(p => p.nama?.toLowerCase().includes(searchTerm.toLowerCase()));

  const stats = {
    hadir: Object.values(presensiMap).filter(p => p.status === 'Hadir').length,
    izin: Object.values(presensiMap).filter(p => p.status === 'Izin').length,
    sakit: Object.values(presensiMap).filter(p => p.status === 'Sakit').length,
    alpa: Object.values(presensiMap).filter(p => p.status === 'Alpa').length,
    belum: pegawai.length - Object.keys(presensiMap).length
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Clock className="text-primary" /> Presensi Pegawai
          </h2>
          <p className="text-gray-500 text-sm mt-1">Sistem presensi mandiri dan rekapitulasi kehadiran.</p>
        </div>
        <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => setCurrentTab('saya')}
            className={`px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors ${currentTab === 'saya' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <UserCheck size={16} /> Presensi Saya
          </button>
          {isOperator && (
            <button
              onClick={() => setCurrentTab('rekap')}
              className={`px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors ${currentTab === 'rekap' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <FileText size={16} /> Rekap Operator
            </button>
          )}
        </div>
      </div>

      {currentTab === 'saya' && (
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-gray-100 max-w-2xl mx-auto w-full">
          {isMyLoading ? (
            <div className="text-center py-10 text-gray-500">Memuat data Anda...</div>
          ) : (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 text-primary rounded-full mb-4 shadow-inner">
                  <UserCheck size={40} />
                </div>
                <h3 className="text-2xl font-bold text-gray-800">Halo, {currentUser?.nama || 'Pegawai'}!</h3>
                <p className="text-gray-500 mt-2">Hari ini: <span className="font-semibold text-gray-700">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
              </div>

              {!myPresensi.id ? (
                // BELUM ABSEN SAMA SEKALI HARI INI
                myPresensi.status === 'Izin' ? (
                  // MODE ISI FORM IZIN
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <AlertCircle className="text-yellow-600" size={20} /> Form Izin / Sakit
                    </h4>
                    <div className="mb-4">
                      <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Pilih Jenis</label>
                      <select
                        value={myPresensi.keterangan_jenis || 'Izin'}
                        onChange={e => setMyPresensi(p => ({ ...p, keterangan_jenis: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                      >
                        <option value="Izin">Izin</option>
                        <option value="Sakit">Sakit</option>
                      </select>
                    </div>
                    <div className="mb-6">
                      <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Alasan / Keterangan</label>
                      <textarea
                        rows="3"
                        value={myPresensi.keterangan}
                        onChange={e => setMyPresensi(p => ({ ...p, keterangan: e.target.value }))}
                        placeholder="Berikan alasan izin/sakit yang jelas..."
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                      ></textarea>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setMyPresensi(p => ({ ...p, status: '' }))}
                        className="flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 py-3 rounded-xl font-bold transition"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => handleSimpanMyPresensi({ ...myPresensi, status: myPresensi.keterangan_jenis || 'Izin' })}
                        disabled={!myPresensi.keterangan || isSavingMy}
                        className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-xl font-bold shadow-md transition disabled:opacity-50"
                      >
                        Kirim Surat Izin
                      </button>
                    </div>
                  </div>
                ) : (
                  // TOMBOL UTAMA ABSEN
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                    <button
                      onClick={handleActionHadir}
                      className="bg-green-500 hover:bg-green-600 text-white p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3 transform hover:-translate-y-1"
                    >
                      <CheckCircle size={48} />
                      <span className="text-xl font-bold tracking-wide">HADIR</span>
                      <span className="text-sm opacity-80 font-medium">Jam Masuk (Otomatis)</span>
                    </button>
                    <button
                      onClick={() => setMyPresensi(p => ({ ...p, status: 'Izin' }))}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3 transform hover:-translate-y-1"
                    >
                      <AlertCircle size={48} />
                      <span className="text-xl font-bold tracking-wide">IZIN / SAKIT</span>
                      <span className="text-sm opacity-80 font-medium">Beri Keterangan</span>
                    </button>
                  </div>
                )
              ) : (
                // SUDAH ABSEN (TAMPILKAN STATUS & TOMBOL PULANG JIKA PERLU)
                <div className="max-w-lg mx-auto">
                  {myPresensi.status === 'Hadir' ? (
                    <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-8 text-center shadow-sm">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-4">
                        <CheckCircle size={32} />
                      </div>
                      <h4 className="text-2xl font-bold text-green-800 mb-2">Anda Sudah Absen Masuk</h4>
                      <p className="text-green-700 font-medium mb-6">Jam Kedatangan: <span className="font-mono text-xl bg-white px-3 py-1 rounded-lg border border-green-200">{myPresensi.waktu_datang}</span></p>

                      {!myPresensi.waktu_pulang ? (
                        <div className="pt-4 border-t border-green-200 border-dashed">
                          <p className="text-sm text-green-700 mb-4 font-medium">Jam kerja selesai? Silakan tekan tombol di bawah untuk absen pulang.</p>
                          <button
                            onClick={handleActionPulang}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 font-bold text-lg"
                          >
                            <Clock size={24} /> ABSEN PULANG SEKARANG
                          </button>
                        </div>
                      ) : (
                        <div className="pt-4 border-t border-green-200 border-dashed">
                          <h4 className="text-xl font-bold text-blue-800 mb-2 mt-2">Anda Sudah Absen Pulang</h4>
                          <p className="text-blue-700 font-medium">Jam Kepulangan: <span className="font-mono text-xl bg-white px-3 py-1 rounded-lg border border-blue-200">{myPresensi.waktu_pulang}</span></p>
                          <p className="text-sm text-green-600 mt-6 font-medium italic">Terima kasih atas kerja keras Anda hari ini! Selamat beristirahat.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-3xl p-8 text-center shadow-sm">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full mb-4">
                        <AlertCircle size={32} />
                      </div>
                      <h4 className="text-2xl font-bold text-yellow-800 mb-2">Status Hari Ini: {myPresensi.status.toUpperCase()}</h4>
                      <p className="text-yellow-700 mb-4 bg-white p-4 rounded-xl border border-yellow-200 italic shadow-inner">"{myPresensi.keterangan}"</p>
                      <p className="text-sm text-yellow-600 font-medium">Data izin/sakit Anda telah tercatat di sistem.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {currentTab === 'rekap' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-1 flex flex-col gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">Pilih Tanggal</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="date"
                    value={tanggal}
                    onChange={e => setTanggal(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">Cari Pegawai</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Ketik nama..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50"
                  />
                </div>
              </div>
              <button onClick={handleExportCSV} className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-sm transition">
                <Download size={16} /> Export Excel
              </button>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Ringkasan Harian</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-green-600 font-medium"><CheckCircle size={16} /> Hadir</span>
                  <span className="font-bold text-gray-800">{stats.hadir}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-blue-600 font-medium"><AlertCircle size={16} /> Izin</span>
                  <span className="font-bold text-gray-800">{stats.izin}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-yellow-600 font-medium"><AlertCircle size={16} /> Sakit</span>
                  <span className="font-bold text-gray-800">{stats.sakit}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-red-600 font-medium"><XCircle size={16} /> Alpa</span>
                  <span className="font-bold text-gray-800">{stats.alpa}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t mt-2">
                  <span className="flex items-center gap-2 text-gray-500 font-medium"><Clock size={16} /> Belum Absen</span>
                  <span className="font-bold text-gray-500">{stats.belum}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] font-bold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Nama Pegawai</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Jam Datang</th>
                    <th className="px-6 py-4">Jam Pulang</th>
                    <th className="px-6 py-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {isLoading ? (
                    <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400">Memuat data rekap...</td></tr>
                  ) : filteredPegawai.length === 0 ? (
                    <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400">Pegawai tidak ditemukan.</td></tr>
                  ) : (
                    filteredPegawai.map(peg => {
                      const p = presensiMap[peg.id];
                      return (
                        <tr key={peg.id} className="hover:bg-gray-50 transition group">
                          <td className="px-6 py-4 font-bold text-gray-800">{peg.nama}</td>
                          <td className="px-6 py-4">
                            {p ? (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold
                                ${p.status === 'Hadir' ? 'bg-green-100 text-green-700' :
                                  p.status === 'Izin' ? 'bg-blue-100 text-blue-700' :
                                    p.status === 'Sakit' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'}`}
                              >
                                {p.status}
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">Belum Absen</span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-gray-600">{p?.waktu_datang || '-'}</td>
                          <td className="px-6 py-4 font-mono text-gray-600">{p?.waktu_pulang || '-'}</td>
                          <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate" title={p?.alasan}>{p?.alasan || '-'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
