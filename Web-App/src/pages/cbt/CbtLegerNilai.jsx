import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
  Award, ArrowLeft, Download, CheckCircle2, AlertCircle, Edit3,
  BarChart3, Users, Star, Brain, Check, RefreshCw, Printer,
  Filter, ArrowUpDown, Clock, RotateCcw, UserCheck, AlertTriangle
} from 'lucide-react';
import { calculatePsychometrics } from '../../services/cbt/aiGradingService';
import { calculateCbtFinalScore } from '../../services/cbt/scoringService';

export default function CbtLegerNilai() {
  const { jadwalId } = useParams();
  const navigate = useNavigate();

  const [jadwal, setJadwal] = useState(null);
  const [sesiList, setSesiList] = useState([]);
  const [soalList, setSoalList] = useState([]);
  const [jawabanList, setJawabanList] = useState([]);
  const [psychometrics, setPsychometrics] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [ruangList, setRuangList] = useState([]);

  const [activeTab, setActiveTab] = useState('leger'); // 'leger' | 'analisis'
  const [loading, setLoading] = useState(true);

  // Filter & Urutan
  const [selectedKelasTab, setSelectedKelasTab] = useState('all');
  const [filterRuang, setFilterRuang] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // '' | 'lulus' | 'belum_tuntas' | 'belum_mulai'
  const [sortBy, setSortBy] = useState('peringkat_asc'); // 'nipd_asc' | 'nipd_desc' | 'nama_asc' | 'nama_desc' | 'ruang_asc' | 'ruang_desc' | 'peringkat_asc' | 'peringkat_desc'
  const [toggleRanking, setToggleRanking] = useState(true);

  const KKM = 75;

  // Modal Review & Koreksi AI oleh Guru
  const [selectedStudentAnswers, setSelectedStudentAnswers] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [tempScores, setTempScores] = useState({});

  useEffect(() => {
    fetchLegerData();
  }, [jadwalId]);

  const fetchLegerData = async () => {
    setLoading(true);
    try {
      // 1. Ambil jadwal
      const { data: jData, error: jErr } = await supabase
        .from('cbt_jadwal_ujian')
        .select(`
          *,
          data_kelas(id, nama_kelas),
          data_mapel(nama_mapel),
          data_ruang(id, nama_ruang),
          guru_pengampu:data_guru!cbt_jadwal_ujian_guru_id_fkey(nama),
          cbt_bank_soal(id, total_soal, skema_konversi)
        `)
        .eq('id', jadwalId)
        .single();

      if (jErr) throw jErr;
      setJadwal(jData);

      // Ambil daftar kelas & ruang untuk filter & mapping
      const [kRes, rRes] = await Promise.all([
        supabase.from('data_kelas').select('id, nama_kelas, tingkat').order('nama_kelas'),
        supabase.from('data_ruang').select('id, nama_ruang').order('nama_ruang')
      ]);
      const allKelas = kRes.data || [];
      const allRuang = rRes.data || [];
      if (kRes.data) setKelasList(kRes.data);
      if (rRes.data) setRuangList(rRes.data);

      // 2. Ambil butir soal
      let sData = [];
      let targetBankId = jData.bank_soal_id;
      if (!targetBankId && jData.mapel_id) {
        const { data: qBank } = await supabase
          .from('cbt_bank_soal')
          .select('id')
          .eq('mapel_id', jData.mapel_id)
          .order('id', { ascending: false })
          .limit(1);
        if (qBank && qBank.length > 0) {
          targetBankId = qBank[0].id;
        }
      }
      if (targetBankId) {
        const { data: qSoal } = await supabase
          .from('cbt_soal')
          .select('*')
          .eq('bank_soal_id', targetBankId)
          .order('nomor_urut');
        sData = qSoal || [];
      }
      setSoalList(sData);

      // 3. Ambil seluruh sesi siswa yang sudah ada di cbt_sesi_siswa
      const { data: sList, error: sErr } = await supabase
        .from('cbt_sesi_siswa')
        .select(`
          *,
          data_siswa(id, nama, nisn, nipd, kelas, status_keaktifan)
        `)
        .eq('jadwal_id', jadwalId);

      if (sErr) throw sErr;

      // 4. Ambil alokasi ruangan siswa di cbt_peserta_ruang jika ada
      let { data: prList } = await supabase
        .from('cbt_peserta_ruang')
        .select('siswa_id, ruang_id, nomor_meja, data_ruang(nama_ruang)')
        .eq('jadwal_id', jadwalId);

      if (!prList || prList.length === 0) {
        const { data: latestPR } = await supabase
          .from('cbt_peserta_ruang')
          .select('jadwal_id')
          .order('id', { ascending: false })
          .limit(1);
        if (latestPR && latestPR.length > 0) {
          const { data: fbPR } = await supabase
            .from('cbt_peserta_ruang')
            .select('siswa_id, ruang_id, nomor_meja, data_ruang(nama_ruang)')
            .eq('jadwal_id', latestPR[0].jadwal_id);
          if (fbPR && fbPR.length > 0) prList = fbPR;
        }
      }

      const prMap = new Map();
      (prList || []).forEach(pr => prMap.set(Number(pr.siswa_id), pr));

      // 5. Kumpulkan siswa: Masukkan semua yang sudah ikut ujian, ditambah siswa sekelas/alokasi (Hanya yang Aktif)
      const studentMap = new Map();

      // Prioritas 1: Masukkan semua siswa yang memiliki sesi nilai dan berstatus aktif
      (sList || []).forEach((s) => {
        if (s.data_siswa && (s.data_siswa.status_keaktifan || '').trim().toLowerCase() === 'aktif' && s.data_siswa.kelas !== 'Calon Siswa') {
          studentMap.set(Number(s.siswa_id), s.data_siswa);
        }
      });

      // Prioritas 2: Siswa dari kelas target atau alokasi ruang yang belum mulai ujian (Hanya yang Aktif)
      if (jData.kelas_id) {
        const kObj = allKelas.find(k => Number(k.id) === Number(jData.kelas_id));
        const targetKelasNama = kObj?.nama_kelas;
        if (targetKelasNama) {
          const { data: siswaKls } = await supabase
            .from('data_siswa')
            .select('id, nama, nisn, nipd, kelas, status_keaktifan')
            .eq('status_keaktifan', 'Aktif')
            .neq('kelas', 'Calon Siswa')
            .eq('kelas', targetKelasNama)
            .order('nama');
          (siswaKls || []).forEach(sw => {
            if (!studentMap.has(Number(sw.id))) {
              studentMap.set(Number(sw.id), sw);
            }
          });
        }
      } else if (prList && prList.length > 0) {
        const enrolledSiswaIds = prList.map(pr => Number(pr.siswa_id)).filter(Boolean);
        if (enrolledSiswaIds.length > 0) {
          const { data: enrolledStudents } = await supabase
            .from('data_siswa')
            .select('id, nama, nisn, nipd, kelas, status_keaktifan')
            .eq('status_keaktifan', 'Aktif')
            .neq('kelas', 'Calon Siswa')
            .in('id', enrolledSiswaIds)
            .order('nama');
          (enrolledStudents || []).forEach(sw => {
            if (!studentMap.has(Number(sw.id))) {
              studentMap.set(Number(sw.id), sw);
            }
          });
        }
      } else if (studentMap.size > 0) {
        // Ambil juga teman sekelas dari siswa yang sudah mulai/selesai ujian (Hanya yang Aktif)
        const classesInSessions = Array.from(new Set(Array.from(studentMap.values()).map(s => s.kelas).filter(Boolean)));
        if (classesInSessions.length > 0) {
          const { data: classmates } = await supabase
            .from('data_siswa')
            .select('id, nama, nisn, nipd, kelas, status_keaktifan')
            .eq('status_keaktifan', 'Aktif')
            .neq('kelas', 'Calon Siswa')
            .in('kelas', classesInSessions)
            .order('nama');
          (classmates || []).forEach(sw => {
            if (!studentMap.has(Number(sw.id))) {
              studentMap.set(Number(sw.id), sw);
            }
          });
        }
      }

      const sesiMap = new Map();
      (sList || []).forEach((s) => sesiMap.set(Number(s.siswa_id), s));

      // Gabungkan siswa dengan sesi pengerjaannya
      const mergedList = Array.from(studentMap.values()).map((siswa) => {
        const s = sesiMap.get(Number(siswa.id));
        const nilai = s?.nilai_akhir !== null && s?.nilai_akhir !== undefined ? parseFloat(s.nilai_akhir) : 0;
        const statusSesi = s?.status || 'belum_mulai';

        let statusKelulusan = 'belum_mulai';
        if (statusSesi === 'selesai') {
          statusKelulusan = nilai >= KKM ? 'lulus' : 'belum_tuntas';
        } else if (statusSesi === 'mengerjakan' || statusSesi === 'dijeda') {
          statusKelulusan = 'mengerjakan';
        } else {
          statusKelulusan = 'belum_mulai';
        }

        const pr = prMap.get(Number(siswa.id));
        const ruangNama = pr?.data_ruang?.nama_ruang || jData?.data_ruang?.nama_ruang || 'Lab CBT';
        const ruangId = pr?.ruang_id || jData?.ruang_id;

        const kObj = allKelas.find(k => (k.nama_kelas || '').trim().toLowerCase() === (siswa.kelas || '').trim().toLowerCase());
        const kelasId = kObj?.id ? String(kObj.id) : (siswa.kelas || 'all');
        const kelasNama = siswa.kelas || kObj?.nama_kelas || 'Kelas';

        return {
          id: s?.id || `draft_${siswa.id}`,
          siswa_id: siswa.id,
          data_siswa: {
            ...siswa,
            nama_lengkap: siswa.nama || siswa.nama_lengkap,
          },
          nilai_akhir: nilai,
          skor_pg: s?.skor_pg ? parseFloat(s.skor_pg) : 0,
          skor_isian: s?.skor_isian ? parseFloat(s.skor_isian) : 0,
          skor_esai: s?.skor_esai ? parseFloat(s.skor_esai) : 0,
          status: statusSesi,
          status_kelulusan: statusKelulusan,
          total_pelanggaran: s?.total_pelanggaran || 0,
          ruang_nama: ruangNama,
          ruang_id: ruangId,
          kelas_nama: kelasNama,
          kelas_id: kelasId,
        };
      });

      // Beri peringkat berdasar nilai_akhir
      const sortedForRank = [...mergedList].sort((a, b) => b.nilai_akhir - a.nilai_akhir);
      sortedForRank.forEach((item, index) => {
        item.peringkat = index + 1;
      });

      setSesiList(sortedForRank);

      // 6. Ambil jawaban siswa untuk analisis
      const sesiIds = (sList || []).map((s) => s.id);
      let allAnswers = [];
      if (sesiIds.length > 0) {
        const { data: aData } = await supabase
          .from('cbt_jawaban_siswa')
          .select('*')
          .in('sesi_id', sesiIds);
        allAnswers = aData || [];
      }
      setJawabanList(allAnswers);

      // 7. Hitung Psikometrik
      const psycho = calculatePsychometrics({
        soals: sData || [],
        sessions: sList || [],
        answers: allAnswers,
      });
      setPsychometrics(psycho);
    } catch (err) {
      console.error('Error fetching leger data:', err);
      Swal.fire('Error', err.message || 'Gagal memuat leger nilai.', 'error');
    } finally {
      setLoading(false);
    }
  };



  // Modal Review Jawaban Siswa
  const openReviewModal = async (sesi) => {
    let studentAnswers = jawabanList.filter((a) => Number(a.sesi_id) === Number(sesi.id));
    if (studentAnswers.length === 0 && sesi.id && !String(sesi.id).startsWith('draft_')) {
      const { data: freshAns } = await supabase
        .from('cbt_jawaban_siswa')
        .select('*')
        .eq('sesi_id', sesi.id);
      if (freshAns && freshAns.length > 0) {
        studentAnswers = freshAns;
      }
    }

    const scoreInit = {};
    studentAnswers.forEach((a) => {
      scoreInit[a.soal_id] =
        a.skor_final_guru !== null ? a.skor_final_guru : a.skor_ai || 0;
    });

    setTempScores(scoreInit);
    setSelectedStudentAnswers({
      sesi,
      siswa: sesi.data_siswa,
      answers: studentAnswers,
    });
    setIsReviewModalOpen(true);
  };

  const handleSaveGuruReview = async () => {
    if (!selectedStudentAnswers) return;

    try {
      let totalSkorPG = 0;
      let maxBobotPG = 0;
      let countPG = 0;

      let totalSkorIsian = 0;
      let maxBobotIsian = 0;
      let countIsian = 0;

      let totalSkorEsai = 0;
      let maxBobotEsai = 0;
      let countEsai = 0;

      for (const soal of soalList) {
        const bobot = parseFloat(soal.bobot_nilai || 1);
        const newScore = parseFloat(tempScores[soal.id] || 0);

        if (soal.jenis_soal === 'pg') {
          countPG++;
          maxBobotPG += bobot;
          totalSkorPG += newScore;
        } else if (soal.jenis_soal === 'isian') {
          countIsian++;
          maxBobotIsian += bobot;
          totalSkorIsian += newScore;
        } else {
          countEsai++;
          maxBobotEsai += bobot;
          totalSkorEsai += newScore;
        }

        const ans = selectedStudentAnswers.answers.find((a) => Number(a.soal_id) === Number(soal.id));
        if (ans) {
          await supabase
            .from('cbt_jawaban_siswa')
            .update({
              skor_final_guru: newScore,
              status_koreksi: 'manual_guru',
              updated_at: new Date().toISOString()
            })
            .eq('id', ans.id);
        } else if (selectedStudentAnswers.sesi?.id && !String(selectedStudentAnswers.sesi.id).startsWith('draft_')) {
          await supabase
            .from('cbt_jawaban_siswa')
            .insert({
              sesi_id: selectedStudentAnswers.sesi.id,
              soal_id: soal.id,
              jawaban_siswa: '',
              skor_final_guru: newScore,
              status_koreksi: 'manual_guru',
              updated_at: new Date().toISOString()
            });
        }
      }

      const skema = jadwal?.skema_konversi || jadwal?.cbt_bank_soal?.skema_konversi || 'asli';
      const scoreResult = calculateCbtFinalScore({
        skorPg: totalSkorPG,
        maxBobotPg: maxBobotPG,
        countPg: countPG,

        skorIsian: totalSkorIsian,
        maxBobotIsian: maxBobotIsian,
        countIsian: countIsian,

        skorEsai: totalSkorEsai,
        maxBobotEsai: maxBobotEsai,
        countEsai: countEsai,

        skemaKonversi: skema,
        kkm: KKM,
      });

      const final100 = scoreResult.finalScore;

      await supabase
        .from('cbt_sesi_siswa')
        .update({
          skor_pg: totalSkorPG,
          skor_isian: totalSkorIsian,
          skor_esai: totalSkorEsai,
          nilai_akhir: final100,
        })
        .eq('id', selectedStudentAnswers.sesi.id);

      Swal.fire({
        icon: 'success',
        title: 'Koreksi Disimpan!',
        text: `Nilai akhir siswa diperbarui menjadi ${final100}.`,
        timer: 1500,
        showConfirmButton: false,
      });

      setIsReviewModalOpen(false);
      fetchLegerData();
    } catch (err) {
      Swal.fire('Gagal Menyimpan', err.message, 'error');
    }
  };

  const parseOptions = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
      return [];
    }
  };

  // Filter & Urutkan Tabel
  const filteredAndSortedSesi = sesiList
    .filter((item) => {
      // Filter Tab Kelas
      if (selectedKelasTab !== 'all') {
        const selKObj = kelasList.find(k => String(k.id) === String(selectedKelasTab));
        const matchId = String(item.kelas_id) === String(selectedKelasTab);
        const matchName = selKObj && String(item.kelas_nama).toLowerCase() === String(selKObj.nama_kelas).toLowerCase();
        if (!matchId && !matchName) return false;
      }
      // Filter Ruang
      if (filterRuang && String(item.ruang_id) !== String(filterRuang)) {
        return false;
      }
      // Filter Status
      if (filterStatus) {
        if (filterStatus === 'lulus' && item.status_kelulusan !== 'lulus') return false;
        if (filterStatus === 'belum_tuntas' && item.status_kelulusan !== 'belum_tuntas') return false;
        if (filterStatus === 'belum_mulai' && item.status_kelulusan !== 'belum_mulai') return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'nipd_asc') return (a.data_siswa?.nipd || '').localeCompare(b.data_siswa?.nipd || '');
      if (sortBy === 'nipd_desc') return (b.data_siswa?.nipd || '').localeCompare(a.data_siswa?.nipd || '');
      if (sortBy === 'nama_asc') return (a.data_siswa?.nama_lengkap || '').localeCompare(b.data_siswa?.nama_lengkap || '');
      if (sortBy === 'nama_desc') return (b.data_siswa?.nama_lengkap || '').localeCompare(a.data_siswa?.nama_lengkap || '');
      if (sortBy === 'ruang_asc') return (a.ruang_nama || '').localeCompare(b.ruang_nama || '');
      if (sortBy === 'ruang_desc') return (b.ruang_nama || '').localeCompare(a.ruang_nama || '');
      if (sortBy === 'peringkat_asc') return (a.peringkat || 999) - (b.peringkat || 999);
      if (sortBy === 'peringkat_desc') return (b.peringkat || 999) - (a.peringkat || 999);
      return 0;
    });

  // Export Excel
  const handleExportExcel = () => {
    const exportData = filteredAndSortedSesi.map((s, idx) => ({
      No: idx + 1,
      NIPD: s.data_siswa?.nipd || '-',
      NISN: s.data_siswa?.nisn || '-',
      'Nama Siswa': s.data_siswa?.nama_lengkap || '-',
      Kelas: s.kelas_nama,
      'Ruang Ujian': s.ruang_nama,
      'Nilai Akhir': s.nilai_akhir || 0,
      Peringkat: s.peringkat,
      Keterangan: s.status_kelulusan.toUpperCase(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leger_Nilai');
    XLSX.writeFile(wb, `Leger_Nilai_${jadwal?.nama_ujian || 'CBT'}.xlsx`);
  };

  const completedSessions = sesiList.filter((s) => s.status === 'selesai');
  const avgScore =
    completedSessions.length > 0
      ? (
          completedSessions.reduce((acc, s) => acc + (s.nilai_akhir || 0), 0) /
          completedSessions.length
        ).toFixed(1)
      : '0';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/cbt/jadwal')}
            className="p-2.5 hover:bg-gray-100 text-gray-600 rounded-xl transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black text-primary">
              Laporan Hasil Ujian & Leger Nilai CBT
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Sesi: <strong>{jadwal?.nama_ujian}</strong> • Mapel: <strong>{jadwal?.data_mapel?.nama_mapel}</strong> • Guru Pengampu: <strong>{jadwal?.guru_pengampu?.nama || jadwal?.guru_pengampu?.nama_guru || '-'}</strong>
            </p>
          </div>
        </div>

        {/* Tombol Header: Refresh & Cetak */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLegerData}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            title="Refresh Data"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-900 bg-secondary hover:bg-lime-500 rounded-xl shadow-sm transition"
            title="Cetak Leger Nilai"
          >
            <Printer size={14} />
            <span>Cetak</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition"
          >
            <Download size={14} />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Skor Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center">
          <span className="text-xs font-bold text-gray-500 uppercase block">Rata-Rata Nilai</span>
          <span className="text-2xl font-black text-primary mt-1 block">{avgScore}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center">
          <span className="text-xs font-bold text-emerald-700 uppercase block">Siswa Lulus (&gt;={KKM})</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {sesiList.filter((s) => s.status_kelulusan === 'lulus').length}
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center">
          <span className="text-xs font-bold text-amber-700 uppercase block">Belum Tuntas (&lt;{KKM})</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">
            {sesiList.filter((s) => s.status_kelulusan === 'belum_tuntas').length}
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center">
          <span className="text-xs font-bold text-slate-700 uppercase block">Belum Ujian</span>
          <span className="text-2xl font-black text-slate-600 mt-1 block">
            {sesiList.filter((s) => s.status_kelulusan === 'belum_mulai').length}
          </span>
        </div>
      </div>

      {/* Filter & Sub-Header */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        {/* Filter Ruang & Status */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
            <Filter size={14} /> Filter:
          </div>

          <select
            value={filterRuang}
            onChange={(e) => setFilterRuang(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl p-2 bg-gray-50 font-medium outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Semua Ruang Ujian</option>
            {ruangList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nama_ruang}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl p-2 bg-gray-50 font-medium outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Semua Status Kelulusan</option>
            <option value="lulus">Lulus (Nilai &gt;= {KKM})</option>
            <option value="belum_tuntas">Belum Tuntas (Nilai &lt; {KKM})</option>
            <option value="belum_mulai">Belum Mulai</option>
          </select>

          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={toggleRanking}
              onChange={(e) => setToggleRanking(e.target.checked)}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <span>Tampilkan Peringkat</span>
          </label>
        </div>

        {/* Urutkan Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
            <ArrowUpDown size={14} /> Urutan:
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl p-2 bg-gray-50 font-medium outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="peringkat_asc">Peringkat (Tertinggi ke Terendah)</option>
            <option value="peringkat_desc">Peringkat (Terendah ke Tertinggi)</option>
            <option value="nama_asc">Nama Siswa (A - Z)</option>
            <option value="nama_desc">Nama Siswa (Z - A)</option>
            <option value="nipd_asc">NIPD (Ascending)</option>
            <option value="nipd_desc">NIPD (Descending)</option>
            <option value="ruang_asc">Ruang Ujian (Ascending)</option>
          </select>
        </div>
      </div>

      {/* Tab per Kelas */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-1">
        <button
          onClick={() => setSelectedKelasTab('all')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap ${
            selectedKelasTab === 'all'
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Semua Kelas ({sesiList.length})
        </button>
        {kelasList.map((k) => {
          const count = sesiList.filter((s) => String(s.kelas_id) === String(k.id) || (s.kelas_nama && String(s.kelas_nama).toLowerCase() === String(k.nama_kelas).toLowerCase())).length;
          if (count === 0) return null;
          return (
            <button
              key={k.id}
              onClick={() => setSelectedKelasTab(String(k.id))}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                selectedKelasTab === String(k.id)
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {k.nama_kelas} ({count})
            </button>
          );
        })}
      </div>

      {/* TABEL DATA SISWA LENGKAP */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b text-gray-600 uppercase font-black tracking-wider">
              <tr>
                <th className="py-3 px-3 text-center">No</th>
                <th className="py-3 px-3">NIPD</th>
                <th className="py-3 px-3">NISN</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-3">Kelas</th>
                <th className="py-3 px-3">Ruang Ujian</th>
                <th className="py-3 px-3 text-center">Nilai</th>
                {toggleRanking && <th className="py-3 px-3 text-center">Peringkat</th>}
                <th className="py-3 px-3 text-center">Keterangan</th>
                <th className="py-3 px-4 text-center">Aksi Guru Mapel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-400">
                    Memuat hasil penilaian siswa...
                  </td>
                </tr>
              ) : filteredAndSortedSesi.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-400">
                    Tidak ada data siswa yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredAndSortedSesi.map((s, idx) => {
                  const isLulus = s.status_kelulusan === 'lulus';

                  return (
                    <tr key={s.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-3 text-gray-600 font-mono">{s.data_siswa?.nipd || '-'}</td>
                      <td className="py-3 px-3 text-gray-500 font-mono">{s.data_siswa?.nisn || '-'}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">
                        {s.data_siswa?.nama_lengkap || '-'}
                      </td>
                      <td className="py-3 px-3 text-gray-700 font-semibold">{s.kelas_nama}</td>
                      <td className="py-3 px-3 text-gray-600">{s.ruang_nama}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 bg-blue-50 text-primary font-black text-sm rounded-lg">
                          {s.nilai_akhir || 0}
                        </span>
                      </td>

                      {toggleRanking && (
                        <td className="py-3 px-3 text-center">
                          <span className="font-extrabold text-xs text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            #{s.peringkat}
                          </span>
                        </td>
                      )}

                      {/* Kolom Keterangan */}
                      <td className="py-3 px-3 text-center">
                        {isLulus ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-black rounded-lg text-[10px] uppercase tracking-wider">
                            LULUS
                          </span>
                        ) : s.status === 'selesai' ? (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-black rounded-lg text-[10px] uppercase tracking-wider">
                            BELUM TUNTAS
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-50 text-slate-600 font-black rounded-lg text-[10px] uppercase tracking-wider">
                            BELUM UJIAN
                          </span>
                        )}
                      </td>

                      {/* Kolom Aksi Guru Mapel */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Tinjau Koreksi AI */}
                          <button
                            onClick={() => openReviewModal(s)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-gray-700 font-semibold rounded-lg text-[11px] transition"
                            title="Tinjau & Koreksi Jawaban"
                          >
                            Tinjau AI
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Review & Koreksi AI oleh Guru */}
      {isReviewModalOpen && selectedStudentAnswers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl my-8 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start border-b pb-4 shrink-0">
              <div>
                <h3 className="text-base font-bold text-primary flex items-center gap-2">
                  <Brain className="text-secondary" size={20} />
                  <span>Koreksi & Verifikasi Nilai Semantik AI</span>
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Siswa: <strong>{selectedStudentAnswers.siswa?.nama_lengkap}</strong> (NISN:{' '}
                  {selectedStudentAnswers.siswa?.nisn})
                </p>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {soalList.map((soal) => {
                const ans = selectedStudentAnswers.answers.find((a) => Number(a.soal_id) === Number(soal.id));
                const currentScore = tempScores[soal.id] !== undefined ? tempScores[soal.id] : (ans?.skor_final_guru ?? ans?.skor_ai ?? 0);
                const userAns = ans?.jawaban_siswa;
                const hasAnswered = userAns !== undefined && userAns !== null && String(userAns).trim() !== '';

                const opsiList = parseOptions(soal.opsi_jawaban);
                const chosenOpsi = opsiList.find(
                  (o) => String(o.id).trim().toUpperCase() === String(userAns).trim().toUpperCase()
                );
                const keyOpsi = opsiList.find(
                  (o) => String(o.id).trim().toUpperCase() === String(soal.kunci_jawaban).trim().toUpperCase()
                );

                const isPg = soal.jenis_soal === 'pg';
                const isIsian = soal.jenis_soal === 'isian';
                const isEsai = soal.jenis_soal === 'esai';

                return (
                  <div key={soal.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-primary text-white flex items-center justify-center text-xs font-bold">
                          {soal.nomor_urut}
                        </span>
                        <span className="text-xs font-bold text-gray-700 uppercase">
                          {soal.jenis_soal} • Bobot: {soal.bobot_nilai} Poin
                        </span>
                      </div>
                      <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-gray-200 shadow-2xs">
                        <span className="text-xs font-bold text-gray-600">Skor Guru:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={soal.bobot_nilai}
                          value={currentScore}
                          onChange={(e) =>
                            setTempScores({ ...tempScores, [soal.id]: e.target.value })
                          }
                          className="w-16 p-1 text-center font-black text-xs border rounded-lg bg-blue-50/50 text-primary outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-900 font-medium whitespace-pre-wrap">{soal.pertanyaan}</p>

                    {soal.gambar_url && (
                      <img
                        src={soal.gambar_url}
                        alt={`Soal #${soal.nomor_urut}`}
                        className="max-h-48 rounded-lg border border-gray-200 object-contain bg-white p-1"
                      />
                    )}

                    {/* Tampilan Jawaban & Kunci Berdasarkan Jenis Soal */}
                    {isPg && (
                      <div className="space-y-2">
                        <div className="p-3 bg-white rounded-xl border text-xs space-y-1.5">
                          <span className="text-[11px] font-bold text-gray-500 block">Jawaban Siswa:</span>
                          {hasAnswered ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-black ${
                                  ans?.is_benar
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                Pilihan {userAns} {ans?.is_benar ? '(Benar) ✓' : '(Salah) ✗'}
                              </span>
                              <span className="text-gray-800 font-medium">
                                {chosenOpsi?.text || ''}
                              </span>
                            </div>
                          ) : (
                            <p className="text-rose-600 italic font-medium">(Siswa tidak menjawab)</p>
                          )}
                        </div>

                        <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-emerald-900">Kunci Jawaban Resmi:</span>
                          <span className="font-bold text-emerald-950">
                            Pilihan {soal.kunci_jawaban} {keyOpsi?.text ? `(${keyOpsi.text})` : ''}
                          </span>
                        </div>
                      </div>
                    )}

                    {isIsian && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-3 bg-white rounded-xl border">
                          <span className="text-[11px] font-bold text-gray-500 block mb-1">Jawaban Siswa:</span>
                          {hasAnswered ? (
                            <div className="flex items-center gap-2">
                              <p className={`font-bold ${ans?.is_benar ? 'text-emerald-700' : 'text-rose-700'}`}>
                                "{userAns}"
                              </p>
                              <span
                                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                  ans?.is_benar
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {ans?.is_benar ? 'Benar ✓' : 'Salah ✗'}
                              </span>
                            </div>
                          ) : (
                            <p className="text-rose-600 italic font-medium">(Siswa tidak menjawab)</p>
                          )}
                        </div>

                        <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                          <span className="text-[11px] font-bold text-amber-900 block mb-1">Kunci Jawaban Resmi:</span>
                          <p className="font-bold text-amber-950">"{soal.kunci_jawaban || '-'}"</p>
                        </div>
                      </div>
                    )}

                    {isEsai && (
                      <div className="space-y-2 text-xs">
                        <div className="p-3 bg-white rounded-xl border space-y-1">
                          <span className="text-[11px] font-bold text-gray-500 block">Jawaban Uraian Siswa:</span>
                          {hasAnswered ? (
                            <p className="text-gray-900 whitespace-pre-wrap leading-relaxed font-medium bg-gray-50/80 p-2.5 rounded-lg border border-gray-100">
                              {userAns}
                            </p>
                          ) : (
                            <p className="text-rose-600 italic font-medium">(Siswa tidak menjawab)</p>
                          )}
                        </div>

                        {soal.rubrik_esai && (
                          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-1">
                            <span className="text-[11px] font-bold text-blue-900 block">Rubrik Penilaian Guru:</span>
                            <p className="text-blue-950 text-[11px] whitespace-pre-wrap leading-relaxed">
                              {soal.rubrik_esai}
                            </p>
                          </div>
                        )}

                        <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1.5">
                              <Brain size={13} className="text-purple-700" /> Evaluasi Semantik Model AI:
                            </span>
                            {ans?.skor_ai !== null && ans?.skor_ai !== undefined && (
                              <span className="text-[10px] font-black px-2 py-0.5 bg-purple-200 text-purple-900 rounded-full">
                                Rekomendasi Skor AI: {ans.skor_ai} / {soal.bobot_nilai} Poin
                              </span>
                            )}
                          </div>
                          <p className="text-purple-900 text-[11px] leading-relaxed font-medium">
                            {ans?.feedback_ai ||
                              (ans?.skor_ai !== null && ans?.skor_ai !== undefined
                                ? `Model AI mengevaluasi kesesuaian uraian siswa dengan kata kunci pada rubrik guru dan memberikan rekomendasi skor ${ans.skor_ai} poin.`
                                : 'Model AI mencocokkan kemiripan semantik dengan rubrik guru.')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t shrink-0">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveGuruReview}
                className="px-5 py-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Simpan Penilaian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
