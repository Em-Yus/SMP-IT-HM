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
  AlertCircle,
  ShieldAlert,
  FileText,
  X,
  Check,
  XCircle,
  HelpCircle,
  Eye
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

export default function CbtJadwalSiswa() {
  const navigate = useNavigate();
  const [siswa, setSiswa] = useState(null);
  const [jadwalList, setJadwalList] = useState([]);
  const [sesiMap, setSesiMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('semua');
  const [isStudentActive, setIsStudentActive] = useState(true);
  const [statusKeaktifan, setStatusKeaktifan] = useState('Aktif');

  // State Review Lembar Koreksi Soal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedReviewJadwal, setSelectedReviewJadwal] = useState(null);
  const [selectedReviewSesi, setSelectedReviewSesi] = useState(null);
  const [reviewSoalList, setReviewSoalList] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewTabFilter, setReviewTabFilter] = useState('all');

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

      const isAktif = (dbSiswa?.status_keaktifan || '').trim().toLowerCase() === 'aktif';
      if (!dbSiswa || !isAktif) {
        setIsStudentActive(false);
        setStatusKeaktifan(dbSiswa?.status_keaktifan || 'Nonaktif');
        setJadwalList([]);
        setLoading(false);
        return;
      }
      setIsStudentActive(true);
      setStatusKeaktifan('Aktif');

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
      let defaultPRuang = null;
      (pRuangData || []).forEach((pr) => {
        pRuangMap.set(Number(pr.jadwal_id), pr);
        if (!defaultPRuang) defaultPRuang = pr;
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
        .select('id, judul, total_soal, mapel_id, tingkat_kelas')
        .or(`tingkat_kelas.eq.${tingkatSiswa || '0'},tingkat_kelas.eq.Semua`);

      // 4. Ambil riwayat sesi ujian siswa terlebih dahulu
      const { data: sesiData } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('siswa_id', parsedSiswa.id);

      const mapping = {};
      sesiData?.forEach(s => {
        mapping[s.jadwal_id] = s;
      });
      setSesiMap(mapping);

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const filtered = (jadwalData || []).filter((j) => {
        const sesi = mapping[j.id];

        // A. Validasi Kesesuaian Kelas:
        // Jika jadwal memiliki kelas_id tertentu (bukan Semua Kelas / null), pastikan kelas siswa cocok
        if (j.kelas_id && kelasId && Number(j.kelas_id) !== Number(kelasId)) {
          if (!pRuangMap.has(Number(j.id))) return false;
        }


        // B. Riwayat Ujian Selesai / Sedang Dikerjakan (selalu tampil)
        if (sesi?.status === 'selesai' || sesi?.status === 'mengerjakan' || sesi?.status === 'diblokir') {
          return true;
        }

        // C. Validasi Tanggal Ujian: Hanya tampil jika tanggal ujian adalah hari ini
        if (j.tanggal_ujian !== todayStr) {
          return false;
        }

        return true;
      }).map((j) => {
        const pr = pRuangMap.get(Number(j.id)) || defaultPRuang;
        // Cari bank soal yang cocok untuk tingkat kelas siswa
        const matchedBank = (availableBanks || []).find(b =>
          Number(b.mapel_id) === Number(j.mapel_id) &&
          (String(b.tingkat_kelas) === String(tingkatSiswa) || String(b.tingkat_kelas) === 'Semua')
        );

        const effBank = matchedBank || (j.bank_soal_id ? (Array.isArray(j.cbt_bank_soal) ? j.cbt_bank_soal[0] : j.cbt_bank_soal) : null);

        return {
          ...j,
          cbt_bank_soal: effBank || j.cbt_bank_soal,
          ruang_nama: pr?.data_ruang?.nama_ruang || null,
          nomor_meja: pr?.nomor_meja || null
        };
      });

      setJadwalList(filtered);
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

  const handleOpenReviewModal = async (jadwalItem, sesiItem) => {
    try {
      setSelectedReviewJadwal(jadwalItem);
      setSelectedReviewSesi(sesiItem);
      setIsReviewModalOpen(true);
      setReviewLoading(true);
      setReviewTabFilter('all');

      let targetBankId = jadwalItem.bank_soal_id;
      if (!targetBankId && jadwalItem.cbt_bank_soal?.id) {
        targetBankId = jadwalItem.cbt_bank_soal.id;
      }

      if (!targetBankId) {
        const { data: bData } = await supabase
          .from('cbt_bank_soal')
          .select('id')
          .eq('mapel_id', jadwalItem.mapel_id)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (bData?.id) targetBankId = bData.id;
      }

      if (!targetBankId) {
        setReviewSoalList([]);
        setReviewLoading(false);
        return;
      }

      // 1. Ambil seluruh butir soal
      const { data: soals, error: sErr } = await supabase
        .from('cbt_soal')
        .select('*')
        .eq('bank_soal_id', targetBankId)
        .order('nomor_urut', { ascending: true });
      if (sErr) throw sErr;

      // 2. Ambil seluruh jawaban siswa untuk sesi ini
      const { data: answers, error: aErr } = await supabase
        .from('cbt_jawaban_siswa')
        .select('*')
        .eq('sesi_id', sesiItem.id);
      if (aErr) throw aErr;

      const answerMap = new Map();
      (answers || []).forEach(a => answerMap.set(a.soal_id, a));

      // 3. Gabungkan butir soal dengan lembar koreksi
      const combined = (soals || []).map(s => {
        const a = answerMap.get(s.id);
        const userAns = a?.jawaban_siswa ?? '';
        let isCorrect = a?.is_benar;
        let skorEarned = a?.skor_final_guru ?? a?.skor_ai ?? 0;

        if (s.jenis_soal === 'pg') {
          if (isCorrect === null || isCorrect === undefined) {
            isCorrect = String(userAns).trim().toUpperCase() === String(s.kunci_jawaban).trim().toUpperCase() && userAns !== '';
          }
          if (isCorrect && !skorEarned) {
            skorEarned = parseFloat(s.bobot_nilai || 1);
          }
        } else if (s.jenis_soal === 'isian') {
          if (isCorrect === null || isCorrect === undefined) {
            const keyAnsList = (s.kunci_jawaban || '').split(/[,;|]/).map(k => k.trim().toLowerCase());
            isCorrect = userAns !== '' && (keyAnsList.includes(userAns.toLowerCase()) || userAns.toLowerCase() === (s.kunci_jawaban || '').trim().toLowerCase());
          }
          if (isCorrect && !skorEarned) {
            skorEarned = parseFloat(s.bobot_nilai || 1);
          }
        }

        return {
          ...s,
          jawaban_siswa: userAns,
          is_benar: isCorrect,
          skor_diperoleh: skorEarned,
          status_koreksi: a?.status_koreksi || 'selesai'
        };
      });

      setReviewSoalList(combined);
    } catch (err) {
      console.error('Error open review modal:', err);
    } finally {
      setReviewLoading(false);
    }
  };

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
      ) : !isStudentActive ? (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-8 text-center max-w-2xl mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <XCircle size={36} />
          </div>
          <h3 className="text-xl font-bold text-rose-900 mb-2">Akses Ujian Tidak Tersedia</h3>
          <p className="text-sm text-rose-700 leading-relaxed mb-4">
            Status akun siswa Anda saat ini adalah <span className="font-bold underline uppercase">{statusKeaktifan}</span>.
            Sesuai ketentuan, hanya siswa dengan status keaktifan <strong>Aktif</strong> yang berhak mengikuti ujian CBT.
          </p>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-rose-700 bg-white px-4 py-2 rounded-xl border border-rose-200 shadow-sm">
            Silakan hubungi pihak sekolah / Tata Usaha jika terdapat kekeliruan data status keaktifan Anda.
          </div>
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

            const now = new Date();
            const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const jamMulaiStr = jadwal.jam_mulai ? jadwal.jam_mulai.slice(0, 5) : null;
            const jamSelesaiStr = jadwal.jam_selesai ? jadwal.jam_selesai.slice(0, 5) : null;
            const isBelumMulai = !isMengerjakan && !isSelesai && !isDiblokir && jamMulaiStr && (nowTimeStr < jamMulaiStr);
            const isLewatWaktu = !isMengerjakan && !isSelesai && !isDiblokir && jamSelesaiStr && (nowTimeStr > jamSelesaiStr);

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
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                        isLewatWaktu
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : isBelumMulai
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        <span>
                          {isLewatWaktu
                            ? 'Waktu Berakhir'
                            : isBelumMulai
                            ? `Mulai Pukul ${jamMulaiStr} WIB`
                            : 'Siap Dikerjakan'}
                        </span>
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
                    <div className="space-y-2.5">
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

                      {/* Tombol Lihat Koreksian Soal */}
                      <button
                        type="button"
                        onClick={() => handleOpenReviewModal(jadwal, sesi)}
                        className="w-full py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                      >
                        <FileText size={15} />
                        <span>Lihat Koreksian Soal</span>
                      </button>
                    </div>
                  ) : isDiblokir ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 bg-rose-50 text-rose-800 p-3 rounded-2xl border border-rose-200 text-xs font-semibold">
                        <Lock size={16} className="text-rose-600 shrink-0" />
                        <span>Akses Anda telah diblokir pengawas. Harap hubungi pengawas ruang.</span>
                      </div>
                      <button
                        onClick={() => navigate(`/cbt/ujian/${jadwal.id}`)}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200"
                      >
                        <ShieldAlert size={15} />
                        <span>Kembali ke Halaman Terblokir</span>
                      </button>
                    </div>
                  ) : isLewatWaktu ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 bg-rose-50 text-rose-500 cursor-not-allowed border border-rose-200"
                    >
                      <Lock size={15} />
                      <span>Waktu Ujian Telah Berakhir ({jamSelesaiStr} WIB)</span>
                    </button>
                  ) : isBelumMulai ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                    >
                      <Lock size={15} />
                      <span>Ujian Dimulai Pukul {jamMulaiStr} WIB</span>
                    </button>
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

      {/* ========================================================
          MODAL REVIEW HASIL KOREKSIAN UJIAN SISWA (READ-ONLY)
      ======================================================== */}
      {isReviewModalOpen && selectedReviewJadwal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-primary to-[#281b54] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                  <FileText className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold leading-tight">
                    Lembar Hasil Koreksi Ujian
                  </h2>
                  <p className="text-xs text-white/80 mt-0.5">
                    {selectedReviewJadwal.data_mapel?.nama_mapel || selectedReviewJadwal.nama_ujian} • {selectedReviewJadwal.nama_ujian}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Score Metric Cards */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Nilai Akhir</span>
                  <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">
                    {selectedReviewSesi?.nilai_akhir !== null && selectedReviewSesi?.nilai_akhir !== undefined
                      ? Number(selectedReviewSesi.nilai_akhir).toFixed(1)
                      : '-'}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-blue-100 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">Pilihan Ganda</span>
                  <div className="text-lg sm:text-xl font-black text-blue-900 mt-0.5">
                    {selectedReviewSesi?.skor_pg !== null && selectedReviewSesi?.skor_pg !== undefined
                      ? Number(selectedReviewSesi.skor_pg).toFixed(1)
                      : '0.0'}{' '}
                    <span className="text-xs font-semibold text-gray-400">/ 100</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-amber-100 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">Isian Singkat</span>
                  <div className="text-lg sm:text-xl font-black text-amber-900 mt-0.5">
                    {selectedReviewSesi?.skor_isian !== null && selectedReviewSesi?.skor_isian !== undefined
                      ? Number(selectedReviewSesi.skor_isian).toFixed(1)
                      : '0.0'}{' '}
                    <span className="text-xs font-semibold text-gray-400">/ 100</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-purple-100 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">Esai</span>
                  <div className="text-lg sm:text-xl font-black text-purple-900 mt-0.5">
                    {selectedReviewSesi?.skor_esai !== null && selectedReviewSesi?.skor_esai !== undefined
                      ? Number(selectedReviewSesi.skor_esai).toFixed(1)
                      : '0.0'}{' '}
                    <span className="text-xs font-semibold text-gray-400">/ 100</span>
                  </div>
                </div>
              </div>

              {/* Tabs Filter */}
              <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pt-1">
                <button
                  type="button"
                  onClick={() => setReviewTabFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    reviewTabFilter === 'all'
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  Semua ({reviewSoalList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewTabFilter('pg')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    reviewTabFilter === 'pg'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  Pilihan Ganda ({reviewSoalList.filter(s => s.jenis_soal === 'pg').length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewTabFilter('isian')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    reviewTabFilter === 'isian'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  Isian Singkat ({reviewSoalList.filter(s => s.jenis_soal === 'isian').length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewTabFilter('esai')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    reviewTabFilter === 'esai'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  Esai ({reviewSoalList.filter(s => s.jenis_soal === 'esai').length})
                </button>
              </div>
            </div>

            {/* Modal Body - Question List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {reviewLoading ? (
                <div className="py-16 text-center">
                  <div className="w-9 h-9 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-semibold text-gray-500 mt-3">Memuat lembar koreksi...</p>
                </div>
              ) : reviewSoalList.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <FileQuestion size={36} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-bold text-gray-600">Tidak ada butir soal yang ditemukan.</p>
                </div>
              ) : (
                reviewSoalList
                  .filter(s => reviewTabFilter === 'all' || s.jenis_soal === reviewTabFilter)
                  .map((soal) => {
                    const isPg = soal.jenis_soal === 'pg';
                    const isIsian = soal.jenis_soal === 'isian';
                    const isEsai = soal.jenis_soal === 'esai';

                    return (
                      <div
                        key={soal.id}
                        className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs space-y-3"
                      >
                        {/* Header Butir */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 flex items-center justify-center bg-primary text-white text-xs font-black rounded-lg">
                              {soal.nomor_urut}
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                isPg
                                  ? 'bg-blue-50 text-blue-700'
                                  : isIsian
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-purple-50 text-purple-700'
                              }`}
                            >
                              {isPg ? 'Pilihan Ganda' : isIsian ? 'Isian Singkat' : 'Esai'}
                            </span>
                            <span className="text-xs text-gray-400 font-semibold">
                              Bobot: {soal.bobot_nilai} Poin
                            </span>
                          </div>

                          {/* Status Badge */}
                          {isPg || isIsian ? (
                            soal.jawaban_siswa ? (
                              soal.is_benar ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 size={13} />
                                  <span>Benar (+{Number(soal.bobot_nilai).toFixed(1)} Poin)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <XCircle size={13} />
                                  <span>Salah (0 Poin)</span>
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                                <span>Tidak Dijawab (0 Poin)</span>
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <span>Skor: {Number(soal.skor_diperoleh || 0).toFixed(1)} / {Number(soal.bobot_nilai).toFixed(1)} Poin</span>
                            </span>
                          )}
                        </div>

                        {/* Teks Pertanyaan */}
                        <p className="text-sm font-semibold text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {soal.pertanyaan}
                        </p>

                        {/* Gambar Soal (Jika ada) */}
                        {soal.gambar_url && (
                          <div className="my-2 p-2 bg-gray-50 rounded-xl border border-gray-200 inline-block max-w-full">
                            <img
                              src={soal.gambar_url}
                              alt={`Gambar Soal No ${soal.nomor_urut}`}
                              className="max-h-60 max-w-full rounded-lg object-contain"
                            />
                          </div>
                        )}

                        {/* Render Opsi Pilihan Ganda */}
                        {isPg && soal.opsi_jawaban && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {soal.opsi_jawaban.map((op) => {
                              const isChosen = String(soal.jawaban_siswa || '').trim().toUpperCase() === String(op.id).toUpperCase();
                              const isKey = String(soal.kunci_jawaban || '').trim().toUpperCase() === String(op.id).toUpperCase();

                              let cardStyle = 'bg-gray-50 border-gray-200 text-gray-700';
                              let badge = null;

                              if (isChosen && isKey) {
                                cardStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs';
                                badge = (
                                  <span className="text-[10px] text-emerald-800 font-black bg-emerald-100 px-2 py-0.5 rounded">
                                    Jawaban Anda (Benar) ✓
                                  </span>
                                );
                              } else if (isChosen && !isKey) {
                                cardStyle = 'bg-rose-50 border-rose-300 text-rose-950 font-bold';
                                badge = (
                                  <span className="text-[10px] text-rose-800 font-black bg-rose-100 px-2 py-0.5 rounded">
                                    Jawaban Anda (Salah) ✗
                                  </span>
                                );
                              } else if (!isChosen && isKey) {
                                cardStyle = 'bg-emerald-50/60 border-emerald-300 text-emerald-900 font-medium';
                                badge = (
                                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded">
                                    Kunci Jawaban
                                  </span>
                                );
                              }

                              return (
                                <div
                                  key={op.id}
                                  className={`p-3 rounded-xl border flex flex-col gap-1.5 text-xs transition ${cardStyle}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                          isChosen && isKey
                                            ? 'bg-emerald-600 text-white'
                                            : isChosen && !isKey
                                            ? 'bg-rose-600 text-white'
                                            : isKey
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-gray-300 text-gray-700'
                                        }`}
                                      >
                                        {op.id}
                                      </span>
                                      <span className="leading-snug">{op.text}</span>
                                    </div>
                                    {badge}
                                  </div>

                                  {op.gambar_url && (
                                    <div className="mt-1 pl-7">
                                      <img
                                        src={op.gambar_url}
                                        alt={`Gambar Opsi ${op.id}`}
                                        className="max-h-24 rounded-lg border border-gray-200 object-contain bg-white p-1"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Render Isian Singkat */}
                        {isIsian && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className={`p-3 rounded-xl border text-xs ${
                              soal.jawaban_siswa
                                ? soal.is_benar
                                  ? 'bg-emerald-50 border-emerald-200'
                                  : 'bg-rose-50 border-rose-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}>
                              <span className="text-[11px] font-bold text-gray-600 block mb-1">
                                Jawaban Anda:
                              </span>
                              <div className="font-extrabold text-gray-900 bg-white p-2 rounded-lg border border-gray-200">
                                {soal.jawaban_siswa || <span className="text-gray-400 italic font-normal">(Tidak dijawab)</span>}
                              </div>
                            </div>

                            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs">
                              <span className="text-[11px] font-bold text-amber-900 block mb-1">
                                Kunci Jawaban Resmi:
                              </span>
                              <div className="font-extrabold text-amber-950 bg-white p-2 rounded-lg border border-amber-300">
                                {soal.kunci_jawaban}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Render Esai */}
                        {isEsai && (
                          <div className="space-y-2 pt-1 text-xs">
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                              <span className="text-[11px] font-bold text-gray-700 block mb-1">
                                Jawaban Uraian Anda:
                              </span>
                              <div className="bg-white p-2.5 rounded-lg border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed">
                                {soal.jawaban_siswa || <span className="text-gray-400 italic">(Tidak ada jawaban uraian)</span>}
                              </div>
                            </div>

                            {soal.rubrik_esai && (
                              <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
                                <span className="text-[11px] font-bold text-purple-900 block mb-1">
                                  Rubrik & Konsep Penilaian Guru:
                                </span>
                                <div className="bg-white p-2.5 rounded-lg border border-purple-200 text-purple-900 leading-relaxed">
                                  {soal.rubrik_esai}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-gray-500 font-medium">
                Lembar hasil koreksi ini bersifat <b className="text-gray-700">read-only</b> untuk evaluasi belajar peserta didik.
              </span>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition shadow-sm"
              >
                Tutup Lembar Koreksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
