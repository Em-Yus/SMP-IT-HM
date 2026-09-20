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
  const [filterStatus, setFilterStatus] = useState(''); // '' | 'lulus' | 'remedial' | 'susulan'
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
      const { data: jData } = await supabase
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

      setJadwal(jData);

      // Ambil daftar kelas & ruang untuk filter
      const [kRes, rRes] = await Promise.all([
        supabase.from('data_kelas').select('id, nama_kelas').order('nama_kelas'),
        supabase.from('data_ruang').select('id, nama_ruang').order('nama_ruang')
      ]);
      if (kRes.data) setKelasList(kRes.data);
      if (rRes.data) setRuangList(rRes.data);

      // 2. Ambil butir soal
      const { data: sData } = await supabase
        .from('cbt_soal')
        .select('*')
        .eq('bank_soal_id', jData.bank_soal_id)
        .order('nomor_urut');

      setSoalList(sData || []);

      // 3. Ambil seluruh siswa di kelas jadwal tersebut
      const { data: siswaKelas } = await supabase
        .from('data_siswa')
        .select('id, nama_lengkap, nisn, nipd, kelas_id, data_kelas(nama_kelas)')
        .eq('kelas_id', jData.kelas_id)
        .order('nama_lengkap');

      // 4. Ambil seluruh sesi siswa
      const { data: sList } = await supabase
        .from('cbt_sesi_siswa')
        .select('*, data_siswa(id, nama_lengkap, nisn, nipd, kelas_id, data_kelas(nama_kelas))')
        .eq('jadwal_id', jadwalId);

      const sesiMap = new Map();
      (sList || []).forEach((s) => sesiMap.set(s.siswa_id, s));

      // Gabungkan siswa dengan sesi pengerjaannya
      const mergedList = (siswaKelas || []).map((siswa) => {
        const s = sesiMap.get(siswa.id);
        const nilai = s?.nilai_akhir || 0;
        const statusSesi = s?.status || 'belum_mulai';

        let statusKelulusan = 'susulan';
        if (statusSesi === 'selesai') {
          statusKelulusan = nilai >= KKM ? 'lulus' : 'remedial';
        } else if (statusSesi === 'mengerjakan' || statusSesi === 'dijeda') {
          statusKelulusan = 'mengerjakan';
        } else {
          statusKelulusan = 'susulan';
        }

        return {
          id: s?.id || `draft_${siswa.id}`,
          siswa_id: siswa.id,
          data_siswa: siswa,
          nilai_akhir: nilai,
          skor_pg: s?.skor_pg || 0,
          skor_isian: s?.skor_isian || 0,
          skor_esai: s?.skor_esai || 0,
          status: statusSesi,
          status_kelulusan: statusKelulusan,
          total_pelanggaran: s?.total_pelanggaran || 0,
          ruang_nama: jData?.data_ruang?.nama_ruang || 'Lab CBT',
          ruang_id: jData?.ruang_id,
          kelas_nama: siswa.data_kelas?.nama_kelas || jData?.data_kelas?.nama_kelas || 'Kelas',
          kelas_id: siswa.kelas_id || jData?.kelas_id,
          is_remedial: s?.is_remedial || false,
          is_susulan: s?.is_susulan || false,
        };
      });

      // Beri peringkat berdasar nilai_akhir
      const sortedForRank = [...mergedList].sort((a, b) => b.nilai_akhir - a.nilai_akhir);
      sortedForRank.forEach((item, index) => {
        item.peringkat = index + 1;
      });

      setSesiList(sortedForRank);

      // 5. Ambil jawaban siswa untuk analisis
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

      // 6. Hitung Psikometrik
      const psycho = calculatePsychometrics({
        soals: sData || [],
        sessions: sList || [],
        answers: allAnswers,
      });
      setPsychometrics(psycho);
    } catch (err) {
      console.error('Error fetching leger data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Aksi Guru Mapel: Set Remedial
  const handleSetRemedial = async (item) => {
    const confirm = await Swal.fire({
      title: 'Tugaskan Remedial?',
      text: `Siswa ${item.data_siswa?.nama_lengkap} (Nilai: ${item.nilai_akhir}) akan diberikan akses pengerjaan remedial.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Berikan Remedial',
      confirmButtonColor: '#f59e0b',
    });

    if (confirm.isConfirmed) {
      try {
        if (item.id && !item.id.toString().startsWith('draft_')) {
          await supabase
            .from('cbt_sesi_siswa')
            .update({
              is_remedial: true,
              status: 'belum_mulai',
              sisa_detik: (jadwal?.durasi_menit || 90) * 60,
              catatan_pengawas: 'Sesi Ujian Remedial'
            })
            .eq('id', item.id);
        }
        Swal.fire('Berhasil', 'Siswa telah dijadwalkan untuk Remedial.', 'success');
        fetchLegerData();
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  // Aksi Guru Mapel: Set Susulan
  const handleSetSusulan = async (item) => {
    const confirm = await Swal.fire({
      title: 'Jadwalkan Ujian Susulan?',
      text: `Siswa ${item.data_siswa?.nama_lengkap} akan diaktifkan untuk mengikuti sesi ujian susulan.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Jadwalkan Susulan',
      confirmButtonColor: '#2a2c87',
    });

    if (confirm.isConfirmed) {
      try {
        if (item.id && !item.id.toString().startsWith('draft_')) {
          await supabase
            .from('cbt_sesi_siswa')
            .update({
              is_susulan: true,
              status: 'belum_mulai',
              sisa_detik: (jadwal?.durasi_menit || 90) * 60,
              catatan_pengawas: 'Sesi Ujian Susulan'
            })
            .eq('id', item.id);
        } else {
          await supabase
            .from('cbt_sesi_siswa')
            .insert([{
              jadwal_id: jadwalId,
              siswa_id: item.siswa_id,
              status: 'belum_mulai',
              is_susulan: true,
              sisa_detik: (jadwal?.durasi_menit || 90) * 60,
              catatan_pengawas: 'Sesi Ujian Susulan'
            }]);
        }
        Swal.fire('Berhasil', 'Siswa telah dijadwalkan untuk Ujian Susulan.', 'success');
        fetchLegerData();
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  // Modal Review Jawaban Siswa
  const openReviewModal = (sesi) => {
    const studentAnswers = jawabanList.filter((a) => a.sesi_id === sesi.id);
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

        const ans = selectedStudentAnswers.answers.find((a) => a.soal_id === soal.id);
        if (ans) {
          await supabase
            .from('cbt_jawaban_siswa')
            .update({ skor_final_guru: newScore, dikoreksi_manual: true })
            .eq('id', ans.id);
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

  // Filter & Urutkan Tabel
  const filteredAndSortedSesi = sesiList
    .filter((item) => {
      // Filter Tab Kelas
      if (selectedKelasTab !== 'all' && String(item.kelas_id) !== String(selectedKelasTab)) {
        return false;
      }
      // Filter Ruang
      if (filterRuang && String(item.ruang_id) !== String(filterRuang)) {
        return false;
      }
      // Filter Status
      if (filterStatus) {
        if (filterStatus === 'lulus' && item.status_kelulusan !== 'lulus') return false;
        if (filterStatus === 'remedial' && item.status_kelulusan !== 'remedial') return false;
        if (filterStatus === 'susulan' && item.status_kelulusan !== 'susulan') return false;
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
          <span className="text-xs font-bold text-amber-700 uppercase block">Perlu Remedial</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">
            {sesiList.filter((s) => s.status_kelulusan === 'remedial').length}
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center">
          <span className="text-xs font-bold text-rose-700 uppercase block">Ujian Susulan</span>
          <span className="text-2xl font-black text-rose-600 mt-1 block">
            {sesiList.filter((s) => s.status_kelulusan === 'susulan').length}
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
            <option value="remedial">Remedial (Nilai &lt; {KKM})</option>
            <option value="susulan">Susulan (Belum Selesai / 0)</option>
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
          const count = sesiList.filter((s) => String(s.kelas_id) === String(k.id)).length;
          if (count === 0 && String(jadwal?.kelas_id) !== String(k.id)) return null;
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
                  const isRemedial = s.status_kelulusan === 'remedial';
                  const isSusulan = s.status_kelulusan === 'susulan';

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
                        ) : isRemedial ? (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-black rounded-lg text-[10px] uppercase tracking-wider">
                            REMEDIAL
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 font-black rounded-lg text-[10px] uppercase tracking-wider">
                            SUSULAN
                          </span>
                        )}
                      </td>

                      {/* Kolom Aksi Guru Mapel */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Remedial jika nilai < KKM */}
                          {isRemedial && (
                            <button
                              onClick={() => handleSetRemedial(s)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center gap-1"
                              title="Tugaskan Ujian Remedial"
                            >
                              <RotateCcw size={12} />
                              <span>Remedial</span>
                            </button>
                          )}

                          {/* Tombol Susulan jika Siswa Tidak Hadir / Nilai 0 */}
                          {isSusulan && (
                            <button
                              onClick={() => handleSetSusulan(s)}
                              className="px-2.5 py-1 bg-primary hover:bg-blue-900 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center gap-1"
                              title="Jadwalkan Ujian Susulan"
                            >
                              <UserCheck size={12} />
                              <span>Susulan</span>
                            </button>
                          )}

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
                const ans = selectedStudentAnswers.answers.find((a) => a.soal_id === soal.id);
                const currentScore = tempScores[soal.id] || 0;

                return (
                  <div key={soal.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-gray-700">
                        Soal #{soal.nomor_urut} ({soal.jenis_soal.toUpperCase()}) - Bobot: {soal.bobot_nilai} Poin
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-600">Skor:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={soal.bobot_nilai}
                          value={currentScore}
                          onChange={(e) =>
                            setTempScores({ ...tempScores, [soal.id]: e.target.value })
                          }
                          className="w-16 p-1 text-center font-bold text-xs border rounded-lg bg-white"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-900 font-medium whitespace-pre-wrap">{soal.pertanyaan}</p>

                    <div className="p-2.5 bg-white rounded-lg border text-xs space-y-1">
                      <span className="text-[11px] font-bold text-gray-500 block">Jawaban Siswa:</span>
                      <p className="text-gray-800 italic">
                        {ans?.jawaban_teks || '(Siswa tidak menjawab)'}
                      </p>
                    </div>

                    {soal.jenis_soal === 'esai' && (
                      <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200 text-xs space-y-1">
                        <span className="text-[11px] font-bold text-purple-900 block">
                          Evaluasi Semantik Model AI:
                        </span>
                        <p className="text-purple-800 text-[11px] leading-relaxed">
                          {ans?.penjelasan_ai || 'Model mencocokkan kemiripan semantik dengan rubrik guru.'}
                        </p>
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
