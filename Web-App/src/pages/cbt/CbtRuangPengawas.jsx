import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import {
  Video, ShieldAlert, ShieldCheck, Clock, Users, ArrowLeft,
  AlertTriangle, MessageSquare, PlusCircle, PauseCircle, PlayCircle,
  Ban, Unlock, CheckCircle2, RefreshCw, Eye, StopCircle, Radio, MicOff, Camera,
  Building, Printer, FileText, X
} from 'lucide-react';

export default function CbtRuangPengawas() {
  const { jadwalId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlRuangId = searchParams.get('ruangId') || 'semua';
  const [selectedRuangId, setSelectedRuangId] = useState(urlRuangId);
  const [ruangList, setRuangList] = useState([]);
  const [activeRuangTabs, setActiveRuangTabs] = useState([]);

  const [jadwal, setJadwal] = useState(null);
  const [sesiList, setSesiList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Live Video Feed Siswa Realtime
  const [liveVideoFeeds, setLiveVideoFeeds] = useState({}); // { [siswaId]: { image, timestamp, faceStatus } }
  const [previewStudent, setPreviewStudent] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());

  // Timer deteksi liveness video feed (update setiap 3 detik)
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);

  // Modal Kirim Pesan
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [targetSesi, setTargetSesi] = useState(null); // null = Pesan Global
  const [pesanTeks, setPesanTeks] = useState('');

  useEffect(() => {
    fetchJadwalAndSessions();

    // 1. Setup Supabase Realtime Postgres Changes
    const dbChannel = supabase
      .channel(`cbt_pengawas_db_${jadwalId}`)
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

    // 2. Setup Realtime Broadcast untuk Menerima Live Video Kamera Siswa
    const examChannel = supabase
      .channel(`cbt_exam_${jadwalId}`)
      .on('broadcast', { event: 'student_video_feed' }, ({ payload }) => {
        if (payload?.siswaId) {
          setLiveVideoFeeds((prev) => ({
            ...prev,
            [payload.siswaId]: {
              image: payload.image,
              timestamp: payload.timestamp || Date.now(),
              faceStatus: payload.faceStatus || 'normal',
            },
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(examChannel);
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
          data_ruang(id, nama_ruang),
          pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama),
          cbt_bank_soal(total_soal)
        `)
        .eq('id', jadwalId)
        .single();

      if (jErr) throw jErr;
      setJadwal(jData);

      // 2. Ambil master data seluruh ruangan
      const { data: rList } = await supabase
        .from('data_ruang')
        .select('id, nama_ruang')
        .order('id');
      setRuangList(rList || []);

      // 3. Cek alokasi ruangan di cbt_peserta_ruang
      const { data: pRuangData } = await supabase
        .from('cbt_peserta_ruang')
        .select(`
          id,
          siswa_id,
          ruang_id,
          nomor_meja,
          data_ruang(id, nama_ruang),
          data_siswa:siswa_id(id, nama, nisn, nipd, foto_url, kelas, status_keaktifan)
        `)
        .eq('jadwal_id', jadwalId);

      let allSiswa = [];
      const distinctRuangMap = new Map();

      if (pRuangData && pRuangData.length > 0) {
        allSiswa = pRuangData
          .filter((p) => p.data_siswa && (!p.data_siswa.status_keaktifan || p.data_siswa.status_keaktifan === 'Aktif'))
          .map((p) => {
            const rId = p.ruang_id;
            const rNama = p.data_ruang?.nama_ruang || `Ruang ${rId}`;
            if (!distinctRuangMap.has(String(rId))) {
              distinctRuangMap.set(String(rId), rNama);
            }
            return {
              ...p.data_siswa,
              ruang_id: rId,
              ruang_nama: rNama,
              nomor_meja: p.nomor_meja,
            };
          });
      }

      // Fallback: jika belum ada alokasi khusus cbt_peserta_ruang, ambil siswa berdasarkan kelas jadwal
      if (allSiswa.length === 0) {
        let q = supabase
          .from('data_siswa')
          .select('id, nama, nisn, nipd, foto_url, kelas, status_keaktifan')
          .eq('status_keaktifan', 'Aktif')
          .neq('kelas', 'Calon Siswa')
          .order('nama');

        if (jData.data_kelas?.nama_kelas) {
          q = q.eq('kelas', jData.data_kelas.nama_kelas);
        }

        const { data: fallbackSiswa } = await q;
        const defaultRuangNama = jData.data_ruang?.nama_ruang || 'Lab CBT';
        const defaultRuangId = jData.ruang_id || 1;
        distinctRuangMap.set(String(defaultRuangId), defaultRuangNama);

        allSiswa = (fallbackSiswa || []).map((s) => ({
          ...s,
          ruang_id: defaultRuangId,
          ruang_nama: defaultRuangNama,
          nomor_meja: null,
        }));
      }

      // Bangun daftar tab ruangan aktif
      const tabs = Array.from(distinctRuangMap.entries()).map(([id, nama]) => ({
        id,
        nama,
      }));
      setActiveRuangTabs(tabs);

      // 4. Ambil sesi pengerjaan siswa
      const { data: sesiData } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('jadwal_id', jadwalId);

      const sesiMap = new Map();
      (sesiData || []).forEach((s) => sesiMap.set(s.siswa_id, s));

      const combined = allSiswa.map((siswa) => {
        const s = sesiMap.get(siswa.id) || {
          id: null,
          siswa_id: siswa.id,
          status: 'belum_mulai',
          sisa_detik: (jData.durasi_menit || 90) * 60,
          total_pelanggaran: 0,
          nilai_akhir: 0,
        };
        return {
          ...siswa,
          nama: siswa.nama || siswa.nama_lengkap || 'Siswa',
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

  // Filter sesi berdasarkan ruangan terpilih
  const displayedSesiList = selectedRuangId && selectedRuangId !== 'semua'
    ? sesiList.filter((s) => String(s.ruang_id) === String(selectedRuangId))
    : sesiList;

  // ==========================================
  // KONTROL GLOBAL RUANG PENGAWASAN
  // ==========================================

  // 1. Kirim Pesan Massal
  const handleOpenGlobalMsg = () => {
    setTargetSesi(null);
    setPesanTeks('');
    setIsMsgModalOpen(true);
  };

  // 2. Tambah Waktu Massal Seluruh Siswa di Ruangan Terpilih
  const handleAddExtraTimeGlobal = async (minutes = 10) => {
    const activeSessions = displayedSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'mengerjakan');
    if (activeSessions.length === 0) {
      Swal.fire('Info', 'Tidak ada siswa yang sedang aktif mengerjakan di ruangan ini.', 'info');
      return;
    }

    const confirm = await Swal.fire({
      title: `Tambah Waktu +${minutes} Menit?`,
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
    const targetStatus = action === 'pause' ? 'dijeda' : 'mengerjakan';
    const filterFrom = action === 'pause' ? 'mengerjakan' : 'dijeda';

    const targetSessions = displayedSesiList.filter(s => s.sesi?.id && s.sesi?.status === filterFrom);
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
    const activeSessions = displayedSesiList.filter(s => s.sesi?.id && (s.sesi?.status === 'mengerjakan' || s.sesi?.status === 'dijeda'));
    if (activeSessions.length === 0) {
      Swal.fire('Info', 'Tidak ada siswa yang sedang aktif ujian.', 'info');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Hentikan Ujian Serentak?',
      text: `Seluruh sesi pengerjaan (${activeSessions.length} siswa) akan dipaksa selesai dan jawaban dikunci.`,
      icon: 'warning',
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
        // Kirim ke seluruh siswa aktif di ruangan terpilih
        const activeSessions = displayedSesiList.filter(s => s.sesi?.id);
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

  // Ringkasan berdasarkan siswa yang sedang dimonitor
  const totalSiswa = displayedSesiList.length;
  const sedangMengerjakan = displayedSesiList.filter((s) => s.sesi?.status === 'mengerjakan').length;
  const sudahSelesai = displayedSesiList.filter((s) => s.sesi?.status === 'selesai').length;
  const diblokir = displayedSesiList.filter((s) => s.sesi?.status === 'diblokir').length;
  const totalPelanggaran = displayedSesiList.reduce((acc, s) => acc + (s.sesi?.total_pelanggaran || 0), 0);

  return (
    <div className="bg-[#edfbf1] min-h-screen p-4 md:p-6 space-y-4 rounded-3xl">
      {/* Header Utama Pengawasan (Persis Gambar 1) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100/70 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* Sisi Kiri: Tombol Back, Badge Live, Judul & Meta */}
        <div className="flex items-start md:items-center gap-3">
          <button
            onClick={() => navigate('/cbt/jadwal')}
            className="p-2 hover:bg-gray-100 text-slate-600 rounded-xl transition mt-0.5 md:mt-0"
            title="Kembali ke Jadwal Ujian"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-0.5 bg-rose-50 border border-rose-300 text-rose-600 rounded-full text-[11px] font-bold tracking-wide animate-pulse">
                <Radio size={13} />
                <span>LIVE MONITOR PENGAWAS</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {jadwal?.nama_ujian || 'PSTS IPA Ganjil'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Kelas: <strong>{jadwal?.data_kelas?.nama_kelas || '-'}</strong> • Mata Pelajaran:{' '}
              <strong>{jadwal?.data_mapel?.nama_mapel || '-'}</strong> • Pengawas:{' '}
              <strong>{jadwal?.pengawas?.nama || 'Muhammad Nadiri'}</strong>
            </p>
          </div>
        </div>

        {/* Sisi Kanan: 4 Counter KPI (TOTAL, AKTIF, SELESAI, ANOMALI) */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end overflow-x-auto pb-1 lg:pb-0">
          <div className="border border-blue-200 bg-blue-50/70 rounded-2xl py-2 px-4 text-center min-w-[85px] shadow-2xs">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">TOTAL</span>
            <span className="text-2xl font-black text-blue-600 block">{totalSiswa}</span>
          </div>
          <div className="border border-emerald-200 bg-emerald-50/70 rounded-2xl py-2 px-4 text-center min-w-[85px] shadow-2xs">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">AKTIF</span>
            <span className="text-2xl font-black text-emerald-600 block">{sedangMengerjakan}</span>
          </div>
          <div className="border border-purple-200 bg-purple-50/70 rounded-2xl py-2 px-4 text-center min-w-[85px] shadow-2xs">
            <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider block">SELESAI</span>
            <span className="text-2xl font-black text-purple-600 block">{sudahSelesai}</span>
          </div>
          <div className="border border-rose-200 bg-rose-50/70 rounded-2xl py-2 px-4 text-center min-w-[85px] shadow-2xs">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">ANOMALI</span>
            <span className="text-2xl font-black text-rose-600 block">{totalPelanggaran}</span>
          </div>
        </div>
      </div>

      {/* Sub-Bar Filter Ruang & Dokumen Cetak (Jika Ada Lebih Dari 1 Ruangan) */}
      {activeRuangTabs.length > 1 && (
        <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-xs border border-emerald-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Building size={14} className="text-emerald-700" /> Filter Ruang:
            </span>
            <button
              onClick={() => {
                setSelectedRuangId('semua');
                setSearchParams({});
              }}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition ${selectedRuangId === 'semua'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-slate-700'
                }`}
            >
              Semua Ruangan ({sesiList.length})
            </button>
            {activeRuangTabs.map((tab) => {
              const count = sesiList.filter((s) => String(s.ruang_id) === String(tab.id)).length;
              const isActive = String(selectedRuangId) === String(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedRuangId(String(tab.id));
                    setSearchParams({ ruangId: String(tab.id) });
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-slate-700'
                    }`}
                >
                  <span>{tab.nama}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${isActive ? 'bg-white/20 text-white' : 'bg-emerald-200/80 text-emerald-800'
                      }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate(`/cbt/cetak/hadir-peserta/${jadwalId}`)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-100 text-slate-700 font-bold text-xs rounded-lg border border-gray-200 transition"
              title="Cetak Daftar Hadir Peserta"
            >
              <Printer size={12} />
              <span>Hadir Peserta</span>
            </button>
            <button
              onClick={() => navigate(`/cbt/cetak/berita-acara/${jadwalId}`)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-100 text-slate-700 font-bold text-xs rounded-lg border border-gray-200 transition"
              title="Berita Acara Ujian"
            >
              <FileText size={12} />
              <span>Berita Acara</span>
            </button>
          </div>
        </div>
      )}

      {/* Kontrol Pengawasan Serentak (Persis Gambar 1) */}
      <div className="bg-[#0b1329] text-white px-6 py-3.5 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800/90 rounded-xl text-blue-400">
            <Video size={18} />
          </div>
          <div>
            <span className="text-xs font-bold block text-white">Kontrol Pengawasan Serentak</span>
            <span className="text-[10px] text-slate-400 block">Instruksi & kendali siswa di ruangan terpilih</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Pesan Massal */}
          <button
            onClick={handleOpenGlobalMsg}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-full border border-slate-700 transition"
          >
            <MessageSquare size={13} className="text-blue-400" />
            <span>Pesan Masal</span>
          </button>

          {/* +10 Menit Semua */}
          <button
            onClick={() => handleAddExtraTimeGlobal(10)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-full border border-slate-700 transition"
          >
            <PlusCircle size={13} className="text-emerald-400" />
            <span>+10 Menit Semua</span>
          </button>

          {/* Jeda Semua */}
          <button
            onClick={() => handleTogglePauseGlobal('pause')}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-xs rounded-full border border-amber-500/60 transition"
          >
            <PauseCircle size={13} />
            <span>Jeda Semua</span>
          </button>

          {/* Lanjutkan Semua */}
          <button
            onClick={() => handleTogglePauseGlobal('resume')}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-xs rounded-full border border-emerald-500/60 transition"
          >
            <PlayCircle size={13} />
            <span>Lanjutkan Semua</span>
          </button>

          {/* Hentikan Ujian */}
          <button
            onClick={handleStopAllGlobal}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-full shadow transition"
          >
            <StopCircle size={13} />
            <span>Hentikan Ujian</span>
          </button>
        </div>
      </div>

      {/* Grid Multi-Card Pengawasan 7 Kolom (Persis Gambar 1) */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : displayedSesiList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 font-medium">
          Tidak ada peserta ujian di ruangan ini.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {displayedSesiList.map((siswa) => {
            const sesi = siswa.sesi;
            const isMengerjakan = sesi?.status === 'mengerjakan';
            const isSelesai = sesi?.status === 'selesai';
            const isDijeda = sesi?.status === 'dijeda';
            const isDiblokir = sesi?.status === 'diblokir';
            const isBlocked = isDiblokir;
            const studentDisplayName = String(siswa.nama || siswa.nama_lengkap || 'Nama Siswa');
            const sisaMenit = Math.max(0, Math.floor((sesi?.sisa_detik || 0) / 60));

            const liveFeed = liveVideoFeeds[siswa.id];
            const isFeedRecent = liveFeed?.timestamp && (nowTs - liveFeed.timestamp < 15000);
            const hasLiveVideo = Boolean(liveFeed?.image && isFeedRecent);

            const statusText = isMengerjakan
              ? 'Aktif'
              : isSelesai
                ? 'Selesai'
                : isDijeda
                  ? 'Dijeda'
                  : isDiblokir
                    ? 'Diblokir'
                    : 'Belum Mulai';

            const waktuText = sesi?.sisa_detik ? `${sisaMenit}m` : 'Waktu';

            return (
              <div
                key={siswa.id}
                className={`relative rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 cursor-pointer
                  ${hasLiveVideo && liveFeed.faceStatus !== 'normal'
                    ? 'ring-2 ring-rose-500 ring-offset-1'
                    : hasLiveVideo
                      ? 'ring-1 ring-emerald-400/60'
                      : 'ring-1 ring-gray-200'
                  }`}
                style={{ aspectRatio: '4/3' }}
                onClick={() => setPreviewStudent({ ...siswa, liveFeed })}
              >
                {/* ── LAYER 0: Video / Foto / Inisial — full card ── */}
                <div className="absolute inset-0 bg-slate-700">
                  {hasLiveVideo ? (
                    <img
                      src={liveFeed.image}
                      alt={studentDisplayName}
                      className="absolute inset-0 w-full h-full object-cover -scale-x-100"
                    />
                  ) : siswa.foto_url ? (
                    <img
                      src={siswa.foto_url}
                      alt={studentDisplayName}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`absolute inset-0 flex items-center justify-center text-xl font-black text-white/60
                      ${isMengerjakan ? 'bg-emerald-800' : isSelesai ? 'bg-purple-900' : isDijeda ? 'bg-amber-900' : isDiblokir ? 'bg-rose-900' : 'bg-slate-700'}`}
                    >
                      {studentDisplayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Gradient: atas+bawah gelap agar semua overlay terbaca */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65 pointer-events-none" />
                </div>

                {/* ── LAYER 1: Pills Atas ── */}
                  <span className="absolute top-1.5 left-1.5 bg-black/55 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {siswa.kelas || 'Kelas'}
                  </span>

                  {/* Pill Status — sudut kanan atas */}
                  <span className={`absolute top-1.5 right-1.5 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none
                    ${isMengerjakan ? 'bg-emerald-600/85' : isSelesai ? 'bg-purple-700/85' : isDijeda ? 'bg-amber-600/85' : isDiblokir ? 'bg-rose-600/85' : 'bg-slate-600/85'}`}
                  >
                    {statusText}
                  </span>

                  {/* Pill No. Meja — tengah kiri */}
                  <span className="absolute top-1/2 -translate-y-1/2 left-1.5 bg-black/55 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {siswa.nomor_meja ? `Meja ${siswa.nomor_meja}` : 'Meja'}
                  </span>

                  {/* Pill Waktu — tengah kanan */}
                  <span className="absolute top-1/2 -translate-y-1/2 right-1.5 bg-black/55 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {waktuText}
                  </span>

                  {/* Live dot — tengah bawah area atas */}
                  {hasLiveVideo && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${liveFeed.faceStatus !== 'normal' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${liveFeed.faceStatus !== 'normal' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    </span>
                  )}

                  {/* Anomali Banner */}
                  {hasLiveVideo && liveFeed.faceStatus !== 'normal' && (
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
                      <span className="bg-rose-600/90 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                        ⚠ ANOMALI
                      </span>
                    </div>
                  )}

                {/* ── LAYER 2: Info + Tombol — absolute bottom overlay ── */}
                <div
                  className="absolute bottom-0 inset-x-0 px-1.5 pb-1 pt-0.5 flex flex-col gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Pill Nama */}
                  <div className="bg-black/55 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full truncate text-center">
                    {studentDisplayName}
                  </div>
                  {/* Pill NISN & NIPD */}
                  <div className="bg-black/55 backdrop-blur-sm text-white/90 text-[8px] font-mono px-2 py-0.5 rounded-full truncate text-center">
                    {[siswa.nisn && `NISN: ${siswa.nisn}`, siswa.nipd && `NIPD: ${siswa.nipd}`].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {/* 5 Tombol Aksi */}
                  <div className="flex gap-0.5">
                    {/* 1. Pesan */}
                    <button
                      onClick={() => { setTargetSesi(sesi); setIsMsgModalOpen(true); }}
                      title="Kirim Pesan"
                      className="flex-1 flex items-center justify-center py-1 rounded-md bg-[#06b6d4] hover:bg-[#0891b2] text-white transition"
                    >
                      <MessageSquare size={11} />
                    </button>
                    {/* 2. +10 Menit */}
                    <button
                      onClick={() => handleAddExtraTime(sesi, 10)}
                      title="+10 Menit"
                      className="flex-1 flex items-center justify-center py-1 rounded-md bg-[#22c55e] hover:bg-[#16a34a] text-white transition"
                    >
                      <PlusCircle size={11} />
                    </button>
                    {/* 3. Jeda */}
                    <button
                      onClick={() => handleTogglePause(sesi)}
                      title="Jeda"
                      className="flex-1 flex items-center justify-center py-1 rounded-md bg-[#eab308] hover:bg-[#ca8a04] text-white transition"
                    >
                      <PauseCircle size={11} />
                    </button>
                    {/* 4. Lanjutkan */}
                    <button
                      onClick={() => handleTogglePause(sesi)}
                      title="Lanjutkan"
                      className="flex-1 flex items-center justify-center py-1 rounded-md bg-[#ec4899] hover:bg-[#db2777] text-white transition"
                    >
                      <PlayCircle size={11} />
                    </button>
                    {/* 5. Blokir / Buka Blokir */}
                    <button
                      onClick={() => handleToggleBlock(sesi)}
                      title={isBlocked ? 'Buka Blokir' : 'Blokir'}
                      className={`flex-1 flex items-center justify-center py-1 rounded-md text-white transition ${isBlocked
                        ? 'bg-[#22c55e] hover:bg-[#16a34a]'
                        : 'bg-[#ef4444] hover:bg-[#dc2626]'
                        }`}
                    >
                      {isBlocked ? <Unlock size={11} /> : <Ban size={11} />}
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

      {/* Modal Zoom/Preview Video Live Siswa */}
      {previewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Camera size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    {previewStudent.nama || previewStudent.nama_lengkap || 'Siswa'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Kelas: <span className="text-white font-semibold">{previewStudent.kelas || '-'}</span> • Meja:{' '}
                    <span className="text-white font-semibold">#{previewStudent.nomor_meja || '-'}</span> • NISN:{' '}
                    <span className="text-white font-semibold">{previewStudent.nisn || '-'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewStudent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Video Viewport */}
            <div className="my-5 relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-800 shadow-inner">
              {liveVideoFeeds[previewStudent.id]?.image ? (
                <>
                  <img
                    src={liveVideoFeeds[previewStudent.id].image}
                    alt={previewStudent.nama}
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  {/* Badge Status Live */}
                  <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-lg text-[10px] font-black tracking-wider text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>LIVE STREAM</span>
                  </div>

                  {/* Telemetry Status AI Face */}
                  <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider backdrop-blur-md border ${liveVideoFeeds[previewStudent.id].faceStatus === 'normal'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse'
                    }`}>
                    AI: {liveVideoFeeds[previewStudent.id].faceStatus === 'normal' ? 'WAJAH NORMAL' : `ANOMALI (${liveVideoFeeds[previewStudent.id].faceStatus})`}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                    <Camera size={28} />
                  </div>
                  <p className="text-sm font-bold text-slate-300">Kamera Belum Aktif / Offline</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Siswa belum membuka lembar ujian atau kamera siswa belum diizinkan browser.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions for this Student */}
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                Status Ujian:{' '}
                <strong className="text-white capitalize">
                  {previewStudent.sesi?.status || 'Belum Mulai'}
                </strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setTargetSesi(previewStudent.sesi);
                    setIsMsgModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  <MessageSquare size={13} />
                  <span>Kirim Pesan</span>
                </button>
                <button
                  onClick={() => handleAddExtraTime(previewStudent.sesi, 10)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  <PlusCircle size={13} />
                  <span>+10 Menit</span>
                </button>
                <button
                  onClick={() => handleToggleBlock(previewStudent.sesi)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${previewStudent.sesi?.status === 'diblokir'
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                >
                  {previewStudent.sesi?.status === 'diblokir' ? <Unlock size={13} /> : <Ban size={13} />}
                  <span>{previewStudent.sesi?.status === 'diblokir' ? 'Buka Blokir' : 'Blokir'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
