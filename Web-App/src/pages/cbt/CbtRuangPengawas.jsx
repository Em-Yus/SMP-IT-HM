import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import {
  Video, ShieldAlert, ShieldCheck, Clock, Users, ArrowLeft,
  AlertTriangle, MessageSquare, PlusCircle, PauseCircle, PlayCircle,
  Ban, CheckCircle2, RefreshCw, Eye, StopCircle, Radio, MicOff, Camera
} from 'lucide-react';

export default function CbtRuangPengawas() {
  const { jadwalId } = useParams();
  const navigate = useNavigate();

  const [jadwal, setJadwal] = useState(null);
  const [sesiList, setSesiList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Kirim Pesan
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [targetSesi, setTargetSesi] = useState(null); // null = Pesan Global
  const [pesanTeks, setPesanTeks] = useState('');

  useEffect(() => {
    fetchJadwalAndSessions();

    // Setup Supabase Realtime Subscription
    const channel = supabase
      .channel('cbt_pengawas_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cbt_sesi_siswa', filter: `jadwal_id=eq.${jadwalId}` },
        () => {
          fetchJadwalAndSessions(false);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cbt_log_pelanggaran' },
        () => {
          fetchJadwalAndSessions(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jadwalId]);

  const fetchJadwalAndSessions = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Ambil data jadwal
      const { data: jData, error: jErr } = await supabase
        .from('cbt_jadwal_ujian')
        .select(`
          *,
          data_kelas(id, nama_kelas),
          data_mapel(nama_mapel),
          data_ruang(nama_ruang),
          pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama),
          cbt_bank_soal(total_soal)
        `)
        .eq('id', jadwalId)
        .single();

      if (jErr) throw jErr;
      setJadwal(jData);

      // 2. Ambil daftar siswa di kelas
      const { data: siswaKelas } = await supabase
        .from('data_siswa')
        .select('id, nama_lengkap, nisn, nipd, foto_url')
        .eq('kelas_id', jData.kelas_id)
        .order('nama_lengkap');

      // 3. Ambil sesi pengerjaan siswa
      const { data: sesiData } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('jadwal_id', jadwalId);

      const sesiMap = new Map();
      (sesiData || []).forEach((s) => sesiMap.set(s.siswa_id, s));

      const combined = (siswaKelas || []).map((siswa) => {
        const s = sesiMap.get(siswa.id) || {
          id: null,
          siswa_id: siswa.id,
          status: 'belum_mulai',
          sisa_detik: jData.durasi_menit * 60,
          total_pelanggaran: 0,
          nilai_akhir: 0,
        };
        return {
          ...siswa,
          sesi: s,
        };
      });

      setSesiList(combined);
    } catch (err) {
      console.error('Error fetching pengawas data:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // ==========================================
  // KONTROL GLOBAL RUANG PENGAWASAN
  // ==========================================

  // 1. Kirim Pesan Massal
  const handleOpenGlobalMsg = () => {
    setTargetSesi(null);
    setPesanTeks('');
    setIsMsgModalOpen(true);
  };

  // 2. Tambah Waktu Massal Seluruh Siswa
  const handleAddExtraTimeGlobal = async (minutes = 10) => {
    const activeSessions = sesiList.filter(s => s.sesi?.id && s.sesi?.status === 'mengerjakan');
    if (activeSessions.length === 0) {
      Swal.fire('Info', 'Tidak ada siswa yang sedang aktif mengerjakan.', 'info');
      return;
    }

    const confirm = await Swal.fire({
      title: `Tambah Waktu +${minutes} Menit ke Seluruh Siswa?`,
      text: `Waktu pengerjaan ${activeSessions.length} siswa yang sedang aktif akan ditambah ${minutes} menit.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Tambahkan!',
      confirmButtonColor: '#2a2c87',
    });

    if (confirm.isConfirmed) {
      try {
        const promises = activeSessions.map(s => {
          const newSisa = (s.sesi.sisa_detik || 0) + (minutes * 60);
          return supabase
            .from('cbt_sesi_siswa')
            .update({ sisa_detik: newSisa })
            .eq('id', s.sesi.id);
        });

        await Promise.all(promises);

        Swal.fire({
          icon: 'success',
          title: `+${minutes} Menit Berhasil Ditambahkan`,
          timer: 1500,
          showConfirmButton: false
        });
        fetchJadwalAndSessions(false);
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  // 3. Jeda / Lanjutkan Seluruh Siswa Serentak
  const handleTogglePauseGlobal = async (action) => {
    // action: 'pause' | 'resume'
    const targetStatus = action === 'pause' ? 'dijeda' : 'mengerjakan';
    const filterFrom = action === 'pause' ? 'mengerjakan' : 'dijeda';

    const targetSessions = sesiList.filter(s => s.sesi?.id && s.sesi?.status === filterFrom);
    if (targetSessions.length === 0) {
      Swal.fire('Info', `Tidak ada siswa berstatus '${filterFrom}'.`, 'info');
      return;
    }

    const confirm = await Swal.fire({
      title: action === 'pause' ? 'Jeda Seluruh Siswa?' : 'Lanjutkan Seluruh Siswa?',
      text: `${targetSessions.length} siswa akan di-${action === 'pause' ? 'jeda' : 'lanjutkan'} serentak.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Jalankan!',
      confirmButtonColor: action === 'pause' ? '#f59e0b' : '#10b981',
    });

    if (confirm.isConfirmed) {
      try {
        const promises = targetSessions.map(s =>
          supabase.from('cbt_sesi_siswa').update({ status: targetStatus }).eq('id', s.sesi.id)
        );
        await Promise.all(promises);
        fetchJadwalAndSessions(false);
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  // 4. Hentikan Ujian Serentak
  const handleStopAllGlobal = async () => {
    const activeSessions = sesiList.filter(s => s.sesi?.id && (s.sesi?.status === 'mengerjakan' || s.sesi?.status === 'dijeda'));
    if (activeSessions.length === 0) {
      Swal.fire('Info', 'Tidak ada siswa yang sedang aktif ujian.', 'info');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Hentikan Ujian Serentak?',
      text: `Seluruh sesi pengerjaan (${activeSessions.length} siswa) akan dipaksa selesai dan jawaban dikunci.`,
      icon: 'danger',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hentikan Ujian!',
      confirmButtonColor: '#d33',
    });

    if (confirm.isConfirmed) {
      try {
        const promises = activeSessions.map(s =>
          supabase.from('cbt_sesi_siswa').update({ status: 'selesai' }).eq('id', s.sesi.id)
        );
        await Promise.all(promises);
        Swal.fire('Selesai', 'Ujian telah dihentikan untuk seluruh peserta.', 'success');
        fetchJadwalAndSessions(false);
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  // ==========================================
  // KONTROL PER-GRID PESERTA
  // ==========================================

  const handleAddExtraTime = async (sesi, minutes = 10) => {
    if (!sesi?.id) {
      Swal.fire('Info', 'Siswa belum memulai ujian.', 'info');
      return;
    }
    try {
      const addedSeconds = minutes * 60;
      const newSisa = (sesi.sisa_detik || 0) + addedSeconds;

      const { error } = await supabase
        .from('cbt_sesi_siswa')
        .update({ sisa_detik: newSisa })
        .eq('id', sesi.id);

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: `+${minutes} Menit`,
        timer: 1200,
        showConfirmButton: false,
      });
      fetchJadwalAndSessions(false);
    } catch (err) {
      Swal.fire('Gagal', err.message, 'error');
    }
  };

  const handleTogglePause = async (sesi) => {
    if (!sesi?.id) return;
    const newStatus = sesi.status === 'dijeda' ? 'mengerjakan' : 'dijeda';
    try {
      const { error } = await supabase
        .from('cbt_sesi_siswa')
        .update({ status: newStatus })
        .eq('id', sesi.id);

      if (error) throw error;
      fetchJadwalAndSessions(false);
    } catch (err) {
      Swal.fire('Gagal', err.message, 'error');
    }
  };

  const handleStopSingle = async (sesi) => {
    if (!sesi?.id) return;
    const confirm = await Swal.fire({
      title: 'Hentikan Ujian Siswa Ini?',
      text: 'Sesi siswa akan diakhiri dan jawaban langsung dikirim.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hentikan',
      confirmButtonColor: '#d33',
    });
    if (confirm.isConfirmed) {
      try {
        await supabase
          .from('cbt_sesi_siswa')
          .update({ status: 'selesai' })
          .eq('id', sesi.id);
        fetchJadwalAndSessions(false);
      } catch (err) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  const handleToggleBlock = async (sesi) => {
    if (!sesi?.id) return;
    const isBlocking = sesi.status !== 'diblokir';

    const confirm = await Swal.fire({
      title: isBlocking ? 'Blokir Sesi Ujian Siswa?' : 'Izinkan / Buka Blokir Sesi?',
      text: isBlocking
        ? 'Siswa akan langsung terkunci dan muncul peringatan pemblokiran pada layar ujian.'
        : 'Siswa dapat kembali melanjutkan ujian.',
      icon: isBlocking ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: isBlocking ? 'Ya, Blokir!' : 'Ya, Izinkan Kembali',
      confirmButtonColor: isBlocking ? '#d33' : '#2a2c87',
    });

    if (confirm.isConfirmed) {
      try {
        const { error } = await supabase
          .from('cbt_sesi_siswa')
          .update({ status: isBlocking ? 'diblokir' : 'mengerjakan' })
          .eq('id', sesi.id);

        if (error) throw error;
        Swal.fire('Berhasil', isBlocking ? 'Siswa telah diblokir.' : 'Siswa diizinkan kembali.', 'success');
        fetchJadwalAndSessions(false);
      } catch (err) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!pesanTeks.trim()) return;

    try {
      if (targetSesi?.id) {
        // Kirim ke 1 siswa spesifik
        await supabase
          .from('cbt_sesi_siswa')
          .update({ catatan_pengawas: pesanTeks.trim() })
          .eq('id', targetSesi.id);
      } else {
        // Kirim ke seluruh siswa aktif di jadwal ini
        const activeSessions = sesiList.filter(s => s.sesi?.id);
        const promises = activeSessions.map(s =>
          supabase
            .from('cbt_sesi_siswa')
            .update({ catatan_pengawas: pesanTeks.trim() })
            .eq('id', s.sesi.id)
        );
        await Promise.all(promises);
      }

      Swal.fire({
        icon: 'success',
        title: 'Pesan Peringatan Terkirim',
        text: 'Pesan akan langsung tampil di layar ujian siswa.',
        timer: 1500,
        showConfirmButton: false,
      });
      setIsMsgModalOpen(false);
      setPesanTeks('');
    } catch (err) {
      Swal.fire('Gagal Mengirim', err.message, 'error');
    }
  };

  // Ringkasan
  const totalSiswa = sesiList.length;
  const sedangMengerjakan = sesiList.filter((s) => s.sesi?.status === 'mengerjakan').length;
  const sudahSelesai = sesiList.filter((s) => s.sesi?.status === 'selesai').length;
  const diblokir = sesiList.filter((s) => s.sesi?.status === 'diblokir').length;
  const totalPelanggaran = sesiList.reduce((acc, s) => acc + (s.sesi?.total_pelanggaran || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header Utama Pengawasan */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/cbt/jadwal')}
            className="p-2.5 hover:bg-gray-100 text-gray-600 rounded-xl transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded flex items-center gap-1 animate-pulse">
                <Radio size={12} /> LIVE MONITOR (ZOOM / GMEET GRID)
              </span>
              <h1 className="text-xl font-black text-gray-900">{jadwal?.nama_ujian}</h1>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Kelas: <strong>{jadwal?.data_kelas?.nama_kelas}</strong> • Ruang:{' '}
              <strong>{jadwal?.data_ruang?.nama_ruang || 'Lab CBT'}</strong> • Pengawas:{' '}
              <strong>{jadwal?.pengawas?.nama || jadwal?.pengawas?.nama_guru || 'Pengawas'}</strong>
            </p>
          </div>
        </div>

        {/* Counter Ringkasan Realtime */}
        <div className="grid grid-cols-4 gap-2 w-full md:w-auto">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-center min-w-[75px]">
            <span className="text-[10px] font-bold text-blue-700 uppercase block">Total</span>
            <span className="text-lg font-black text-primary">{totalSiswa}</span>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center min-w-[75px]">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Aktif</span>
            <span className="text-lg font-black text-emerald-700">{sedangMengerjakan}</span>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-center min-w-[75px]">
            <span className="text-[10px] font-bold text-purple-700 uppercase block">Selesai</span>
            <span className="text-lg font-black text-purple-700">{sudahSelesai}</span>
          </div>
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-center min-w-[75px]">
            <span className="text-[10px] font-bold text-red-700 uppercase block">Anomali</span>
            <span className="text-lg font-black text-red-600">{totalPelanggaran}</span>
          </div>
        </div>
      </div>

      {/* TOOLBAR KONTROL GLOBAL (ZOOM / GMEET STYLE) */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-800 rounded-xl text-secondary">
            <Video size={18} />
          </div>
          <div>
            <span className="text-xs font-bold block">Kontrol Pengawasan Global</span>
            <span className="text-[10px] text-slate-400">Instruksi & kendali serentak seluruh peserta</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Kirim Pesan Masal */}
          <button
            onClick={handleOpenGlobalMsg}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition"
          >
            <MessageSquare size={14} className="text-blue-400" />
            <span>Pesan Masal</span>
          </button>

          {/* Tambah Waktu Masal (+10 Menit) */}
          <button
            onClick={() => handleAddExtraTimeGlobal(10)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition"
          >
            <PlusCircle size={14} className="text-emerald-400" />
            <span>+10 Menit Semua</span>
          </button>

          {/* Jeda Semua */}
          <button
            onClick={() => handleTogglePauseGlobal('pause')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 transition"
          >
            <PauseCircle size={14} />
            <span>Jeda Semua</span>
          </button>

          {/* Lanjutkan Semua */}
          <button
            onClick={() => handleTogglePauseGlobal('resume')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl border border-slate-700 transition"
          >
            <PlayCircle size={14} />
            <span>Lanjutkan Semua</span>
          </button>

          {/* Hentikan Ujian Serentak */}
          <button
            onClick={handleStopAllGlobal}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <StopCircle size={14} />
            <span>Hentikan Ujian</span>
          </button>
        </div>
      </div>

      {/* GRID MULTI-VIDEO PENGAWAS (ZOOM / GMEET STYLE) */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      ) : sesiList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
          Tidak ada siswa terdaftar di kelas ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sesiList.map((siswa) => {
            const sesi = siswa.sesi;
            const hasViolation = (sesi?.total_pelanggaran || 0) > 0;
            const isMengerjakan = sesi?.status === 'mengerjakan';
            const isSelesai = sesi?.status === 'selesai';
            const isBlocked = sesi?.status === 'diblokir';
            const isPaused = sesi?.status === 'dijeda';

            return (
              <div
                key={siswa.id}
                className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden flex flex-col justify-between transition ${
                  isBlocked
                    ? 'border-red-500 bg-red-50/20'
                    : isPaused
                    ? 'border-amber-400 bg-amber-50/20'
                    : hasViolation
                    ? 'border-amber-400 shadow-amber-100'
                    : isMengerjakan
                    ? 'border-emerald-400'
                    : 'border-gray-200'
                }`}
              >
                {/* Frame Video / AI Camera Stream Feed */}
                <div className="relative w-full h-36 bg-slate-950 flex items-center justify-center overflow-hidden">
                  {siswa.foto_url ? (
                    <img
                      src={siswa.foto_url}
                      alt={siswa.nama_lengkap}
                      className="w-full h-full object-cover opacity-85"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-lg border border-slate-700">
                      {siswa.nama_lengkap?.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Status Overlay Badge Kiri Atas */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase text-white shadow ${
                        isBlocked
                          ? 'bg-red-600'
                          : isPaused
                          ? 'bg-amber-600'
                          : isSelesai
                          ? 'bg-purple-600'
                          : isMengerjakan
                          ? 'bg-emerald-600'
                          : 'bg-gray-600'
                      }`}
                    >
                      {sesi?.status || 'Belum Mulai'}
                    </span>
                  </div>

                  {/* Indikator Pelanggaran AI Kanan Atas */}
                  {hasViolation && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-600/90 text-white rounded-md text-[10px] font-black flex items-center gap-1 animate-pulse shadow">
                      <ShieldAlert size={12} />
                      <span>{sesi.total_pelanggaran} Anomali</span>
                    </div>
                  )}

                  {/* Footer Frame: Identitas & Icon Audio/Cam */}
                  <div className="absolute bottom-2 inset-x-2 flex items-center justify-between text-white text-[10px] bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded">
                    <span className="truncate font-mono">NISN: {siswa.nisn || '-'}</span>
                    <div className="flex items-center gap-1 text-slate-300">
                      <Camera size={11} className={isMengerjakan ? 'text-emerald-400' : 'text-slate-500'} />
                      <MicOff size={11} className="text-red-400" />
                    </div>
                  </div>
                </div>

                {/* Metadata Siswa & Sisa Waktu */}
                <div className="p-3.5 space-y-2">
                  <h3 className="text-xs font-bold text-gray-900 truncate" title={siswa.nama_lengkap}>
                    {siswa.nama_lengkap}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-blue-500" />
                      <span>
                        Sisa:{' '}
                        <strong>
                          {Math.floor((sesi?.sisa_detik || 0) / 60)} mnt
                        </strong>
                      </span>
                    </div>

                    {isSelesai && (
                      <span className="font-extrabold text-primary bg-blue-50 px-2 py-0.5 rounded">
                        Nilai: {sesi.nilai_akhir || 0}
                      </span>
                    )}
                  </div>

                  {/* KONTROL PER-GRID PESERTA (5 Tombol: Pesan, Waktu, Jeda/Lanjut, Hentikan, Blokir/Izinkan) */}
                  <div className="pt-2 border-t border-gray-100 grid grid-cols-5 gap-1">
                    {/* 1. Kirim Pesan */}
                    <button
                      onClick={() => {
                        setTargetSesi(sesi);
                        setIsMsgModalOpen(true);
                      }}
                      className="p-2 bg-gray-100 hover:bg-blue-50 hover:text-primary text-gray-600 rounded-lg text-center transition"
                      title="Kirim Pesan Peringatan"
                    >
                      <MessageSquare size={13} className="mx-auto" />
                    </button>

                    {/* 2. Tambah Waktu (+10 Menit) */}
                    <button
                      onClick={() => handleAddExtraTime(sesi, 10)}
                      className="p-2 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 rounded-lg text-center transition"
                      title="Tambah Waktu (+10 Menit)"
                    >
                      <PlusCircle size={13} className="mx-auto" />
                    </button>

                    {/* 3. Jeda / Lanjutkan */}
                    <button
                      onClick={() => handleTogglePause(sesi)}
                      className={`p-2 rounded-lg text-center transition ${
                        isPaused
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 hover:bg-amber-50 hover:text-amber-700 text-gray-600'
                      }`}
                      title={isPaused ? 'Lanjutkan Ujian' : 'Jeda Ujian'}
                    >
                      {isPaused ? (
                        <PlayCircle size={13} className="mx-auto" />
                      ) : (
                        <PauseCircle size={13} className="mx-auto" />
                      )}
                    </button>

                    {/* 4. Hentikan Ujian */}
                    <button
                      onClick={() => handleStopSingle(sesi)}
                      className="p-2 bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-600 rounded-lg text-center transition"
                      title="Hentikan Ujian Siswa Ini"
                    >
                      <StopCircle size={13} className="mx-auto" />
                    </button>

                    {/* 5. Blokir / Izinkan */}
                    <button
                      onClick={() => handleToggleBlock(sesi)}
                      className={`p-2 rounded-lg text-center transition ${
                        isBlocked
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-600'
                      }`}
                      title={isBlocked ? 'Izinkan Kembali' : 'Blokir Siswa'}
                    >
                      <Ban size={13} className="mx-auto" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Kirim Pesan Pengawas (Global atau Per Siswa) */}
      {isMsgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-primary mb-1 flex items-center gap-2">
              <MessageSquare size={18} />
              <span>{targetSesi ? 'Kirim Pesan ke Siswa' : 'Kirim Pesan Masal ke Seluruh Siswa'}</span>
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {targetSesi
                ? 'Peringatan akan tampil sebagai banner modal di layar ujian siswa yang bersangkutan.'
                : 'Peringatan akan disiarkan ke seluruh layar ujian siswa di ruangan ini.'}
            </p>

            <form onSubmit={handleSendMessage} className="space-y-4">
              <textarea
                rows={3}
                placeholder="Misal: Harap tertib, jangan menoleh atau membuka aplikasi lain selama ujian berlangsung!"
                value={pesanTeks}
                onChange={(e) => setPesanTeks(e.target.value)}
                className="w-full text-xs border rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMsgModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  Kirim Peringatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
