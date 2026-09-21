import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  BookOpen,
  UserCheck,
  CheckCircle2,
  PlayCircle,
  Lock,
  FileQuestion,
  Award,
  Building,
  Radio,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

export default function CbtJadwalSiswa() {
  const navigate = useNavigate();
  const [siswa, setSiswa] = useState(null);
  const [jadwalList, setJadwalList] = useState([]);
  const [sesiMap, setSesiMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('semua');

  useEffect(() => {
    loadSiswaAndJadwal();
  }, []);

  const loadSiswaAndJadwal = async () => {
    try {
      setLoading(true);
      const userStr = localStorage.getItem('user_siswa');
      if (!userStr) {
        navigate('/login-siswa');
        return;
      }

      const parsedSiswa = JSON.parse(userStr);
      setSiswa(parsedSiswa);

      // 1. Ambil data siswa segar dari Supabase
      const { data: dbSiswa } = await supabase
        .from('data_siswa')
        .select('id, nama, nipd, nisn, kelas, status_keaktifan')
        .eq('id', parsedSiswa.id)
        .maybeSingle();

      if (!dbSiswa || (dbSiswa.status_keaktifan && dbSiswa.status_keaktifan.toLowerCase() !== 'aktif')) {
        setJadwalList([]);
        setLoading(false);
        return;
      }

      const kelasSiswa = dbSiswa?.kelas || parsedSiswa.kelas || '';

      // Tentukan kelasId dan tingkatSiswa
      let kelasId = null;
      let tingkatSiswa = null;
      if (kelasSiswa) {
        const { data: kelasData } = await supabase
          .from('data_kelas')
          .select('id, tingkat')
          .ilike('nama_kelas', kelasSiswa.trim())
          .maybeSingle();
        if (kelasData) {
          kelasId = kelasData.id;
          if (kelasData.tingkat) tingkatSiswa = String(kelasData.tingkat);
        }
      }

      if (!tingkatSiswa && kelasSiswa) {
        const upper = kelasSiswa.toUpperCase().trim();
        if (upper.includes('VII') && !upper.includes('VIII')) tingkatSiswa = '7';
        else if (upper.includes('VIII')) tingkatSiswa = '8';
        else if (upper.includes('IX')) tingkatSiswa = '9';
        else {
          const m = upper.match(/\b([789])\b/);
          if (m) tingkatSiswa = m[1];
        }
      }

      // 2. Cek apakah siswa terdaftar di cbt_peserta_ruang
      const { data: pRuangData } = await supabase
        .from('cbt_peserta_ruang')
        .select('jadwal_id, ruang_id, nomor_meja, data_ruang(nama_ruang)')
        .eq('siswa_id', parsedSiswa.id);

      const pRuangMap = new Map();
      (pRuangData || []).forEach((pr) => {
        pRuangMap.set(Number(pr.jadwal_id), pr);
      });
      const allocatedJadwalIds = Array.from(pRuangMap.keys());

      // 3. Ambil jadwal ujian yang relevan
      let query = supabase
        .from('cbt_jadwal_ujian')
        .select(`
          id, nama_ujian, jenis_ujian, tanggal_ujian, jam_mulai, jam_selesai, durasi_menit, status,
          mapel_id, data_mapel(nama_mapel),
          guru_id, data_guru:data_guru!cbt_jadwal_ujian_guru_id_fkey(nama),
          bank_soal_id, cbt_bank_soal(id, judul, total_soal, tingkat_kelas)
        `)
        .order('tanggal_ujian', { ascending: true })
        .order('jam_mulai', { ascending: true });

      if (allocatedJadwalIds.length > 0) {
        if (kelasId) {
          query = query.or(`id.in.(${allocatedJadwalIds.join(',')}),kelas_id.eq.${kelasId},kelas_id.is.null`);
        } else {
          query = query.or(`id.in.(${allocatedJadwalIds.join(',')}),kelas_id.is.null`);
        }
      } else if (kelasId) {
        query = query.or(`kelas_id.eq.${kelasId},kelas_id.is.null`);
      }

      const { data: jadwalData, error: jadwalErr } = await query;
      if (jadwalErr) throw jadwalErr;

      // Ambil bank soal untuk tingkat kelas
      const { data: availableBanks } = await supabase
        .from('cbt_bank_soal')
        .select('id, mapel_id, tingkat_kelas')
        .or(`tingkat_kelas.eq.${tingkatSiswa || '0'},tingkat_kelas.eq.Semua`);

      const availableMapelIds = new Set((availableBanks || []).map(b => Number(b.mapel_id)));
      const availableBankIds = new Set((availableBanks || []).map(b => Number(b.id)));

      const filtered = (jadwalData || []).filter((j) => {
        // Jika siswa dialokasikan di cbt_peserta_ruang, PASTI BERHAK MENGIKUTI
        if (pRuangMap.has(Number(j.id))) return true;

        if (j.bank_soal_id && availableBankIds.has(Number(j.bank_soal_id))) return true;
        if (j.mapel_id && availableMapelIds.has(Number(j.mapel_id))) return true;
        const bTingkat = Array.isArray(j.cbt_bank_soal)
          ? j.cbt_bank_soal[0]?.tingkat_kelas
          : j.cbt_bank_soal?.tingkat_kelas;
        if (!bTingkat || bTingkat === 'Semua') return true;
        return false;
      }).map((j) => {
        const pr = pRuangMap.get(Number(j.id));
        return {
          ...j,
          ruang_nama: pr?.data_ruang?.nama_ruang || null,
          nomor_meja: pr?.nomor_meja || null
        };
      });

      setJadwalList(filtered);

      // 4. Ambil sesi ujian siswa
      if (filtered.length > 0 && parsedSiswa.id) {
        const jadwalIds = filtered.map(j => j.id);
        const { data: sesiData } = await supabase
          .from('cbt_sesi_siswa')
          .select('*')
          .eq('siswa_id', parsedSiswa.id)
          .in('jadwal_id', jadwalIds);

        const mapping = {};
        sesiData?.forEach(s => {
          mapping[s.jadwal_id] = s;
        });
        setSesiMap(mapping);
      }
    } catch (err) {
      console.error('Error load jadwal CBT:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredJadwal = jadwalList.filter(item => {
    const sesi = sesiMap[item.id];
    if (filterTab === 'selesai') {
      return sesi?.status === 'selesai';
    }
    if (filterTab === 'aktif') {
      return sesi?.status !== 'selesai';
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary to-[#281b54] text-white p-6 md:p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 backdrop-blur-sm">
              <Radio size={14} className="animate-pulse text-red-300" />
              <span>Computer-Based Test (CBT)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Jadwal & Ruang Ujian CBT</h1>
            <p className="text-white/80 text-sm mt-1">
              Daftar sesi ujian online, jadwal pelaksanaan, alokasi ruang, dan nomor meja Anda.
            </p>
          </div>

          {/* Info Siswa */}
          {siswa && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 min-w-[240px]">
              <p className="text-xs text-white/70 font-semibold uppercase tracking-wider">Identitas Peserta</p>
              <p className="text-base font-bold text-white truncate mt-0.5">{siswa.nama || 'Siswa'}</p>
              <p className="text-xs text-white/80 mt-1">
                Kelas: <span className="font-semibold text-white">{siswa.kelas || '-'}</span> • NISN:{' '}
                <span className="font-semibold text-white">{siswa.nisn || siswa.nipd || '-'}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterTab('semua')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterTab === 'semua'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Semua ({jadwalList.length})
          </button>
          <button
            onClick={() => setFilterTab('aktif')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterTab === 'aktif'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Belum / Sedang Ujian
          </button>
          <button
            onClick={() => setFilterTab('selesai')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterTab === 'selesai'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Selesai
          </button>
        </div>

        <button
          onClick={loadSiswaAndJadwal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition"
        >
          <RefreshCw size={14} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Content Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-semibold text-gray-500">Memuat data jadwal ujian CBT...</p>
        </div>
      ) : filteredJadwal.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
            <FileQuestion size={32} />
          </div>
          <h3 className="text-base font-bold text-gray-800">Tidak Ada Jadwal Ujian</h3>
          <p className="text-xs text-gray-500 max-w-sm mt-1">
            Saat ini belum ada sesi ujian CBT yang dijadwalkan untuk Anda pada filter ini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredJadwal.map((jadwal) => {
            const sesi = sesiMap[jadwal.id];
            const isSelesai = sesi?.status === 'selesai';
            const isMengerjakan = sesi?.status === 'mengerjakan';
            const isDiblokir = sesi?.status === 'diblokir';

            return (
              <div
                key={jadwal.id}
                className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Badge Row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {jadwal.jenis_ujian || 'Ujian CBT'}
                    </span>

                    {isSelesai && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={13} />
                        <span>Selesai</span>
                      </span>
                    )}
                    {isMengerjakan && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                        <Clock size={13} />
                        <span>Sedang Mengerjakan</span>
                      </span>
                    )}
                    {isDiblokir && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <Lock size={13} />
                        <span>Akses Diblokir</span>
                      </span>
                    )}
                    {!sesi && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <span>Siap Dikerjakan</span>
                      </span>
                    )}
                  </div>

                  {/* Judul & Mata Pelajaran */}
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">
                    {jadwal.data_mapel?.nama_mapel || jadwal.nama_ujian}
                  </h3>
                  {jadwal.nama_ujian !== jadwal.data_mapel?.nama_mapel && (
                    <p className="text-xs font-medium text-gray-500 mt-1">{jadwal.nama_ujian}</p>
                  )}

                  {/* Meta Details */}
                  <div className="space-y-2 mt-4 text-xs text-gray-600 bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2">
                      <Calendar size={15} className="text-gray-400 shrink-0" />
                      <span>{jadwal.tanggal_ujian || 'Sesuai Jadwal'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={15} className="text-gray-400 shrink-0" />
                      <span>
                        {jadwal.jam_mulai?.slice(0, 5)} - {jadwal.jam_selesai?.slice(0, 5)} WIB ({jadwal.durasi_menit} Menit)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen size={15} className="text-gray-400 shrink-0" />
                      <span>
                        {jadwal.cbt_bank_soal?.total_soal ? `${jadwal.cbt_bank_soal.total_soal} Butir Soal` : 'Paket Soal CBT'}
                      </span>
                    </div>
                    {jadwal.ruang_nama && (
                      <div className="flex items-center gap-2 text-primary font-semibold">
                        <Building size={15} className="text-primary shrink-0" />
                        <span>
                          Ruang: {jadwal.ruang_nama}{jadwal.nomor_meja ? ` • Meja #${jadwal.nomor_meja}` : ''}
                        </span>
                      </div>
                    )}
                    {jadwal.data_guru?.nama && (
                      <div className="flex items-center gap-2">
                        <UserCheck size={15} className="text-gray-400 shrink-0" />
                        <span>Pengampu: {jadwal.data_guru.nama}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-5 pt-4 border-t border-gray-100">
                  {isSelesai ? (
                    <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 p-3 rounded-2xl border border-emerald-200">
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Award size={18} className="text-emerald-600" />
                        <span>Ujian Selesai Dikumpulkan</span>
                      </div>
                      {sesi?.nilai_akhir !== null && sesi?.nilai_akhir !== undefined && (
                        <span className="font-extrabold text-sm text-emerald-900 bg-white px-3 py-1 rounded-xl shadow-xs">
                          Nilai: {Number(sesi.nilai_akhir).toFixed(1)}
                        </span>
                      )}
                    </div>
                  ) : isDiblokir ? (
                    <div className="flex items-center gap-2 bg-rose-50 text-rose-800 p-3 rounded-2xl border border-rose-200 text-xs font-semibold">
                      <Lock size={16} className="text-rose-600 shrink-0" />
                      <span>Akses Anda telah diblokir pengawas. Harap hubungi pengawas ruang.</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => navigate(`/cbt/ujian/${jadwal.id}`)}
                      className={`w-full py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm ${
                        isMengerjakan
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200'
                          : 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
                      }`}
                    >
                      <PlayCircle size={16} />
                      <span>{isMengerjakan ? 'Lanjutkan Pengerjaan Ujian' : 'Mulai Kerjakan Ujian Sekarang'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
