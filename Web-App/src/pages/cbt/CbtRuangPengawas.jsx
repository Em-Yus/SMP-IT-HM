import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import {
  Video, ShieldAlert, ShieldCheck, Clock, Users, ArrowLeft,
  AlertTriangle, MessageSquare, PlusCircle, PauseCircle, PlayCircle,
  Ban, RotateCcw, Lock, Unlock, CheckCircle2, RefreshCw, Eye, StopCircle, Radio, MicOff, Camera,
  Building, Printer, FileText, X, Search
} from 'lucide-react';

export default function CbtRuangPengawas() {
  const { jadwalId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlRuangId = searchParams.get('ruangId') || 'semua';
  const urlKelas = searchParams.get('kelas') || 'semua';
  const [selectedRuangId, setSelectedRuangId] = useState(urlRuangId);
  const [selectedKelas, setSelectedKelas] = useState(urlKelas);
  const [searchQuery, setSearchQuery] = useState('');
  const [ruangList, setRuangList] = useState([]);
  const [activeRuangTabs, setActiveRuangTabs] = useState([]);

  const [jadwal, setJadwal] = useState(null);
  const [sesiList, setSesiList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Live Video Feed & Kehadiran Siswa Realtime
  const [liveVideoFeeds, setLiveVideoFeeds] = useState({}); // { [siswaId]: { image, timestamp, faceStatus } }
  const [studentPresence, setStudentPresence] = useState({}); // { [siswaId]: { timestamp, isOpen, sisaDetik, lastUpdatedTs } }
  const [previewStudent, setPreviewStudent] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());

  // Timer deteksi liveness & tick detik waktu ujian (update setiap 1 detik)
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
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

    // 2. Setup Realtime Broadcast untuk Menerima Live Video Kamera & Status Kehadiran Siswa
    const examChannel = supabase
      .channel(`cbt_exam_${jadwalId}`)
      .on('broadcast', { event: 'student_video_feed' }, ({ payload }) => {
        if (payload?.siswaId) {
          const now = Date.now();
          if (payload.image) {
            setLiveVideoFeeds((prev) => ({
              ...prev,
              [payload.siswaId]: {
                image: payload.image,
                timestamp: payload.timestamp || now,
                faceStatus: payload.faceStatus || 'normal',
              },
            }));
          }
          setStudentPresence((prev) => ({
            ...prev,
            [payload.siswaId]: {
              timestamp: payload.timestamp || now,
              isOpen: payload.isOpen !== false,
              sisaDetik: payload.sisaDetik,
              lastUpdatedTs: now,
            },
          }));
        }
      })
      .on('broadcast', { event: 'student_presence' }, ({ payload }) => {
        if (payload?.siswaId) {
          const now = Date.now();
          setStudentPresence((prev) => ({
            ...prev,
            [payload.siswaId]: {
              timestamp: payload.timestamp || now,
              isOpen: payload.isOpen !== false,
              sisaDetik: payload.sisaDetik,
              lastUpdatedTs: now,
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

      // 3. Penentuan Ruangan Siswa:
      // a. Pengecekan terlebih dahulu ke pengaturan ruang ujian pada jadwal ujian (cbt_peserta_ruang)
      // b. Untuk pengaturan default, mengecek kelas siswa (data_siswa.kelas),
      //    sesuaikan ruangannya dengan melihat data_kelas pada database (data_kelas.ruang_id)
      // c. Tampilkan siswanya pada ruangan pada halaman pengawasan tersebut

      // Ambil master data data_kelas untuk mapping kelas -> ruang
      const { data: kelasList } = await supabase
        .from('data_kelas')
        .select('id, nama_kelas, ruang_id, data_ruang(id, nama_ruang)')
        .order('id');

      const kelasMap = {};
      (kelasList || []).forEach((k) => {
        if (k.nama_kelas) {
          kelasMap[k.nama_kelas.trim().toLowerCase()] = {
            ruang_id: k.ruang_id,
            ruang_nama: k.data_ruang?.nama_ruang || (rList || []).find((r) => r.id === k.ruang_id)?.nama_ruang || `Ruang ${k.ruang_id}`
          };
        }
      });

      // Ambil data pengaturan ruang ujian (cbt_peserta_ruang)
      let { data: pRuangData } = await supabase
        .from('cbt_peserta_ruang')
        .select(`
          id,
          jadwal_id,
          siswa_id,
          ruang_id,
          nomor_meja,
          data_ruang(id, nama_ruang)
        `)
        .eq('jadwal_id', jadwalId);

      // Fallback: Jika jadwal ini belum memiliki entri cbt_peserta_ruang tersendiri,
      // gunakan alokasi ruang peserta terakhir yang sudah pernah disimpan di jadwal lain
      if (!pRuangData || pRuangData.length === 0) {
        const { data: latestPR } = await supabase
          .from('cbt_peserta_ruang')
          .select('jadwal_id')
          .order('id', { ascending: false })
          .limit(1);

        if (latestPR && latestPR.length > 0) {
          const fallbackJId = latestPR[0].jadwal_id;
          const { data: fbData } = await supabase
            .from('cbt_peserta_ruang')
            .select(`
              id,
              jadwal_id,
              siswa_id,
              ruang_id,
              nomor_meja,
              data_ruang(id, nama_ruang)
            `)
            .eq('jadwal_id', fallbackJId);

          if (fbData && fbData.length > 0) {
            pRuangData = fbData;
          }
        }
      }

      const pRuangMap = new Map();
      (pRuangData || []).forEach((p) => {
        pRuangMap.set(String(p.siswa_id), {
          ruang_id: p.ruang_id,
          nomor_meja: p.nomor_meja,
          ruang_nama: p.data_ruang?.nama_ruang || (rList || []).find((r) => r.id === p.ruang_id)?.nama_ruang || `Ruang ${p.ruang_id}`
        });
      });

      const hasPesertaRuang = pRuangData && pRuangData.length > 0;

      // Ambil data siswa yang mengikuti ujian (berdasarkan kelas jadwal atau semua aktif)
      // PENTING: Jika hasPesertaRuang adalah true, JANGAN batasi ke kelas jadwal tunggal,
      // karena alokasi ruang ujian diatur lintas kelas (bisa berisi siswa kelas 7, 8, dan 9 sekaligus).
      let q = supabase
        .from('data_siswa')
        .select('id, nama, nisn, nipd, foto_url, kelas, status_keaktifan')
        .eq('status_keaktifan', 'Aktif')
        .neq('kelas', 'Calon Siswa')
        .order('nama');

      if (!hasPesertaRuang && jData.data_kelas?.nama_kelas) {
        q = q.eq('kelas', jData.data_kelas.nama_kelas);
      }

      const { data: rawSiswa } = await q;

      // Helper Smart Ruang Matcher jika tidak ada di data_kelas langsung
      const getSmartRuang = (sKelas) => {
        const kLower = (sKelas || '').trim().toLowerCase();
        const nonKantor = (rList || []).filter((r) => {
          const nr = (r.nama_ruang || '').toLowerCase();
          return !nr.includes('kantor') && !nr.includes('teras');
        });
        if (kLower.includes('vii') || kLower.startsWith('7')) {
          const r7 = nonKantor.find((r) => r.nama_ruang.toLowerCase().includes('7') || r.nama_ruang.toLowerCase().includes('vii'));
          if (r7) return { id: r7.id, nama_ruang: r7.nama_ruang };
        }
        if (kLower.includes('viii') || kLower.startsWith('8')) {
          const r8 = nonKantor.find((r) => r.nama_ruang.toLowerCase().includes('8') || r.nama_ruang.toLowerCase().includes('viii'));
          if (r8) return { id: r8.id, nama_ruang: r8.nama_ruang };
        }
        if (kLower.includes('ix-a') || kLower.includes('9-a') || kLower.includes('9a')) {
          const r9a = nonKantor.find((r) => {
            const nr = r.nama_ruang.toLowerCase().replace(/[\s-]/g, '');
            return nr.includes('9a') || nr.includes('ixa');
          });
          if (r9a) return { id: r9a.id, nama_ruang: r9a.nama_ruang };
        }
        if (kLower.includes('ix-b') || kLower.includes('9-b') || kLower.includes('9b')) {
          const r9b = nonKantor.find((r) => {
            const nr = r.nama_ruang.toLowerCase().replace(/[\s-]/g, '');
            return nr.includes('9b') || nr.includes('ixb');
          });
          if (r9b) return { id: r9b.id, nama_ruang: r9b.nama_ruang };
        }
        if (kLower.includes('ix') || kLower.startsWith('9')) {
          const r9 = nonKantor.find((r) => r.nama_ruang.toLowerCase().includes('9') || r.nama_ruang.toLowerCase().includes('ix'));
          if (r9) return { id: r9.id, nama_ruang: r9.nama_ruang };
        }
        return { id: jData.ruang_id || 1, nama_ruang: jData.data_ruang?.nama_ruang || 'Ruang CBT' };
      };

      const distinctRuangMap = new Map();

      // Jika cbt_peserta_ruang memiliki data → jadikan source of truth mutlak (lepas dari kelas_id)
      // Hanya siswa yang terdaftar di pengaturan ruang yang ditampilkan.
      // Jika tidak ada → fallback ke logika kelas / heuristik.
      const targetSiswaList = hasPesertaRuang
        ? (rawSiswa || []).filter(s => pRuangMap.has(String(s.id)))
        : (rawSiswa || []);

      const mappedSiswa = targetSiswaList.map((s) => {
        const pAlloc = pRuangMap.get(String(s.id));
        let rId;
        let rNama;

        // 1. Pengecekan terlebih dahulu ke pengaturan ruang ujian pada halaman jadwal ujian
        if (pAlloc) {
          rId = pAlloc.ruang_id;
          rNama = pAlloc.ruang_nama;
        } else {
          // 2. Default: mengecek kelas siswa, sesuaikan dengan melihat data_kelas pada database
          const sKelas = (s.kelas || '').trim().toLowerCase();
          const kInfo = kelasMap[sKelas];
          if (kInfo && kInfo.ruang_id) {
            rId = kInfo.ruang_id;
            rNama = kInfo.ruang_nama;
          } else {
            const smart = getSmartRuang(s.kelas);
            rId = smart.id;
            rNama = smart.nama_ruang;
          }
        }

        if (!distinctRuangMap.has(String(rId))) {
          distinctRuangMap.set(String(rId), rNama);
        }

        return {
          ...s,
          ruang_id: rId,
          ruang_nama: rNama,
        };
      });

      // Kelompokkan siswa berdasarkan ruangan dan urutkan sesuai abjad nama siswa (A-Z)
      // Nomor meja dibedakan per ruangan, mulai dari 1 untuk setiap ruangan
      const siswaByRuang = {};
      mappedSiswa.forEach((sw) => {
        const rKey = String(sw.ruang_id);
        if (!siswaByRuang[rKey]) siswaByRuang[rKey] = [];
        siswaByRuang[rKey].push(sw);
      });

      const allSiswa = [];
      Object.keys(siswaByRuang).forEach((rKey) => {
        const listInRuang = siswaByRuang[rKey];
        listInRuang.sort((a, b) => (a.nama || a.nama_lengkap || '').localeCompare(b.nama || b.nama_lengkap || ''));
        listInRuang.forEach((sw, idx) => {
          allSiswa.push({
            ...sw,
            nomor_meja: idx + 1,
          });
        });
      });

      // Bangun daftar tab ruangan aktif
      // Jika ada pengaturan ruang → urutkan tab sesuai urutan ruang di cbt_peserta_ruang (bukan distinctRuangMap acak)
      let tabs;
      if (hasPesertaRuang) {
        // Urutkan berdasarkan urutan kemunculan di pRuangData (sesuai pengaturan ruang di jadwal)
        const orderedRuangMap = new Map();
        pRuangData.forEach((p) => {
          const key = String(p.ruang_id);
          if (!orderedRuangMap.has(key)) {
            orderedRuangMap.set(key, p.data_ruang?.nama_ruang || (rList || []).find(r => r.id === p.ruang_id)?.nama_ruang || `Ruang ${p.ruang_id}`);
          }
        });
        tabs = Array.from(orderedRuangMap.entries()).map(([id, nama]) => ({ id, nama }));
      } else {
        tabs = Array.from(distinctRuangMap.entries()).map(([id, nama]) => ({ id, nama }));
      }
      setActiveRuangTabs(tabs);
      if ((!urlRuangId || urlRuangId === 'semua') && tabs.length > 0) {
        setSelectedRuangId(tabs[0].id);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('ruangId', tabs[0].id);
          return next;
        }, { replace: true });
      }

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

      // Urutkan daftar sesi: jika satu ruangan urutkan nomor meja (1..N); jika semua ruangan urutkan nama ruangan lalu nomor meja
      combined.sort((a, b) => {
        if (String(a.ruang_id) !== String(b.ruang_id)) {
          return String(a.ruang_nama || '').localeCompare(String(b.ruang_nama || ''));
        }
        return (a.nomor_meja || 0) - (b.nomor_meja || 0);
      });

      setSesiList(combined);
    } catch (err) {
      console.error('Error fetching pengawas data:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Daftar kelas unik dari sesi (jika ruangan dipilih, sesuaikan hanya kelas yang ada di ruangan tersebut)
  const distinctKelasList = React.useMemo(() => {
    const list = selectedRuangId && selectedRuangId !== 'semua'
      ? sesiList.filter((s) => String(s.ruang_id) === String(selectedRuangId))
      : sesiList;
    return Array.from(new Set(list.map((s) => s.kelas).filter(Boolean))).sort();
  }, [sesiList, selectedRuangId]);

  // Reset filter kelas jika kelas terpilih tidak ada di ruangan yang baru dipilih
  useEffect(() => {
    if (selectedKelas !== 'semua' && distinctKelasList.length > 0 && !distinctKelasList.includes(selectedKelas)) {
      setSelectedKelas('semua');
      const p = {};
      if (selectedRuangId !== 'semua') p.ruangId = selectedRuangId;
      setSearchParams(p);
    }
  }, [distinctKelasList, selectedKelas, selectedRuangId]);

  // Filter sesi berdasarkan ruangan, kelas, dan pencarian nama/NISN
  const displayedSesiList = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sesiList.filter((s) => {
      if (selectedRuangId && selectedRuangId !== 'semua' && String(s.ruang_id) !== String(selectedRuangId)) {
        return false;
      }
      if (selectedKelas && selectedKelas !== 'semua' && s.kelas !== selectedKelas) {
        return false;
      }
      if (q) {
        const nama = (s.nama || s.nama_lengkap || '').toLowerCase();
        const nisn = (s.nisn || '').toLowerCase();
        const nipd = (s.nipd || '').toLowerCase();
        const meja = String(s.nomor_meja || '');
        if (!nama.includes(q) && !nisn.includes(q) && !nipd.includes(q) && meja !== q) {
          return false;
        }
      }
      return true;
    });
  }, [sesiList, selectedRuangId, selectedKelas, searchQuery]);

  // ==========================================
  // KONTROL GLOBAL RUANG PENGAWASAN
  // ==========================================

  // 1. Kirim Pesan Massal
  const handleOpenGlobalMsg = () => {
    setTargetSesi(null);
    setPesanTeks('');
    setIsMsgModalOpen(true);
  };

  // Helper untuk mengecek apakah siswa sedang membuka halaman lembar ujian secara aktif
  const isStudentPageOpen = (siswaId) => {
    const presence = studentPresence[siswaId];
    if (!presence) return false;
    if (presence.isOpen === false) return false;
    return (nowTs - (presence.timestamp || 0)) < 10000; // Toleransi 10 detik
  };

  // Helper untuk menghitung sisa waktu berjalan (dengan detik realtime)
  const getLiveSisaDetik = (siswa) => {
    const sesi = siswa.sesi;
    if (!sesi?.id) return 0;
    const presence = studentPresence[siswa.id];
    if (presence?.sisaDetik !== undefined && presence.lastUpdatedTs) {
      if (sesi.status === 'mengerjakan') {
        const elapsed = Math.floor((nowTs - presence.lastUpdatedTs) / 1000);
        return Math.max(0, presence.sisaDetik - elapsed);
      }
      return presence.sisaDetik;
    }
    return sesi.sisa_detik || 0;
  };

  // Helper format detik ke MM:SS atau HH:MM:SS
  const formatTimeWithSeconds = (totalSeconds) => {
    if (totalSeconds === undefined || totalSeconds === null || totalSeconds < 0) return '00:00';
    const total = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mStr = String(m).padStart(2, '0');
    const sStr = String(s).padStart(2, '0');
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  };

  // Pop-up Dinamis Penambahan Menit (Ditengah Layar)
  const promptAddExtraTime = async (defaultMinutes = 10, targetName = null) => {
    const { value: minutes } = await Swal.fire({
      title: 'Tambah Waktu Ujian',
      position: 'center',
      customClass: {
        popup: 'rounded-3xl shadow-2xl p-6',
        confirmButton: 'rounded-xl font-bold px-5 py-2.5',
        cancelButton: 'rounded-xl font-semibold px-4 py-2.5',
      },
      html: `
        <div style="font-size: 13px; color: #475569; margin-bottom: 12px;">
          ${targetName ? `Tambahkan durasi untuk <b>${targetName}</b>:` : 'Tambahkan durasi pengerjaan untuk <b>seluruh siswa aktif</b> di ruangan ini:'}
        </div>
        <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 14px;">
          <button type="button" class="swal-quick-btn" data-min="5" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 12px; font-weight: bold; cursor: pointer; color: #334155;">+5 Menit</button>
          <button type="button" class="swal-quick-btn" data-min="10" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 12px; font-weight: bold; cursor: pointer; color: #334155;">+10 Menit</button>
          <button type="button" class="swal-quick-btn" data-min="15" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 12px; font-weight: bold; cursor: pointer; color: #334155;">+15 Menit</button>
          <button type="button" class="swal-quick-btn" data-min="30" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 12px; font-weight: bold; cursor: pointer; color: #334155;">+30 Menit</button>
        </div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Atau ketik jumlah menit manual:</div>
      `,
      input: 'number',
      inputValue: defaultMinutes,
      inputAttributes: {
        min: '1',
        max: '180',
        step: '1',
        style: 'text-align: center; font-size: 16px; font-weight: bold;'
      },
      didOpen: () => {
        const input = Swal.getInput();
        document.querySelectorAll('.swal-quick-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const m = btn.getAttribute('data-min');
            if (input && m) {
              input.value = m;
              input.focus();
            }
          });
        });
      },
      showCancelButton: true,
      confirmButtonText: 'Tambahkan Waktu',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#10b981',
      inputValidator: (val) => {
        const num = parseInt(val, 10);
        if (!val || isNaN(num) || num <= 0) {
          return 'Masukkan jumlah menit yang valid (minimal 1 menit)!';
        }
      }
    });

    return minutes ? parseInt(minutes, 10) : null;
  };

  // 2. Tambah Waktu Massal Seluruh Siswa di Ruangan Terpilih
  const handleAddExtraTimeGlobal = async () => {
    const activeSessions = displayedSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'mengerjakan');
    if (activeSessions.length === 0) {
      Swal.fire('Info', 'Tidak ada siswa yang sedang aktif mengerjakan di ruangan ini.', 'info');
      return;
    }

    const minutes = await promptAddExtraTime(10);
    if (!minutes) return;

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
        text: `Waktu pengerjaan ${activeSessions.length} siswa telah ditambah ${minutes} menit.`,
        timer: 1500,
        showConfirmButton: false
      });
      fetchJadwalAndSessions(false);
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
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

  // 5. Blokir / Buka Blokir Serentak (Sesuai Tombol Card Siswa)
  const handleToggleBlockGlobal = async () => {
    const blockedSessions = displayedSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'diblokir');
    const activeSessions = displayedSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'mengerjakan');

    if (blockedSessions.length > 0 && activeSessions.length === 0) {
      const confirm = await Swal.fire({
        title: 'Buka Blokir Seluruh Siswa?',
        text: `${blockedSessions.length} siswa diblokir akan diizinkan kembali melanjutkan ujian.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Buka Blokir Semua!',
        confirmButtonColor: '#10b981',
      });
      if (confirm.isConfirmed) {
        try {
          const promises = blockedSessions.map(s =>
            supabase.from('cbt_sesi_siswa').update({ status: 'mengerjakan' }).eq('id', s.sesi.id)
          );
          await Promise.all(promises);
          Swal.fire('Berhasil', 'Seluruh blokir siswa telah dibuka.', 'success');
          fetchJadwalAndSessions(false);
        } catch (err) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    } else {
      const confirm = await Swal.fire({
        title: 'Blokir Seluruh Siswa Aktif?',
        text: `${activeSessions.length} siswa aktif akan diblokir dari pengerjaan ujian.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Blokir Semua!',
        confirmButtonColor: '#d33',
      });
      if (confirm.isConfirmed) {
        try {
          const promises = activeSessions.map(s =>
            supabase.from('cbt_sesi_siswa').update({ status: 'diblokir' }).eq('id', s.sesi.id)
          );
          await Promise.all(promises);
          Swal.fire('Berhasil', 'Seluruh peserta aktif telah diblokir.', 'success');
          fetchJadwalAndSessions(false);
        } catch (err) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    }
  };

  // 6. Force Selesai / Mulai Lagi Serentak (Sesuai Tombol Card Siswa)
  const handleStopOrRestartGlobal = async () => {
    const finishedSessions = displayedSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'selesai');
    const activeSessions = displayedSesiList.filter(s => s.sesi?.id && (s.sesi?.status === 'mengerjakan' || s.sesi?.status === 'dijeda'));

    if (finishedSessions.length > 0 && activeSessions.length === 0) {
      const confirm = await Swal.fire({
        title: 'Mulai Lagi Ujian Seluruh Siswa?',
        text: `${finishedSessions.length} siswa yang telah selesai akan diizinkan melanjutkan ujian kembali.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Mulai Lagi Semua!',
        confirmButtonColor: '#2563eb',
      });
      if (confirm.isConfirmed) {
        try {
          const durationSecs = (jadwal?.durasi_menit || 90) * 60;
          const promises = finishedSessions.map(s => {
            const sisa = (!s.sesi.sisa_detik || s.sesi.sisa_detik <= 0) ? durationSecs : s.sesi.sisa_detik;
            return supabase.from('cbt_sesi_siswa').update({
              status: 'mengerjakan',
              waktu_selesai: null,
              sisa_detik: sisa,
            }).eq('id', s.sesi.id);
          });
          await Promise.all(promises);
          Swal.fire('Berhasil', 'Seluruh peserta selesai dapat melanjutkan ujian kembali.', 'success');
          fetchJadwalAndSessions(false);
        } catch (err) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    } else {
      handleStopAllGlobal();
    }
  };

  // ==========================================
  // KONTROL PER-GRID PESERTA
  // ==========================================

  const handleAddExtraTime = async (sesi, studentName = 'siswa') => {
    if (!sesi?.id) {
      Swal.fire('Info', 'Siswa belum memulai ujian.', 'info');
      return;
    }

    const minutes = await promptAddExtraTime(10, studentName);
    if (!minutes) return;

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
        title: `+${minutes} Menit Ditambahkan`,
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

  const handleRestartSingle = async (sesi, studentName = 'Siswa') => {
    if (!sesi?.id) return;
    const confirm = await Swal.fire({
      title: 'Mulai Lagi Ujian?',
      html: `Apakah Anda yakin ingin mengizinkan <b>${studentName}</b> melanjutkan ujian kembali?<br/><span class="text-xs text-gray-500">Status sesi siswa akan diaktifkan kembali ke 'mengerjakan'.</span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Mulai Lagi',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
    });

    if (confirm.isConfirmed) {
      try {
        const updateData = {
          status: 'mengerjakan',
          waktu_selesai: null,
        };
        if (!sesi.sisa_detik || sesi.sisa_detik <= 0) {
          updateData.sisa_detik = (jadwal?.durasi_menit || 90) * 60;
        }

        const { error } = await supabase
          .from('cbt_sesi_siswa')
          .update(updateData)
          .eq('id', sesi.id);

        if (error) throw error;
        Swal.fire({
          icon: 'success',
          title: 'Ujian Diaktifkan Kembali',
          text: `${studentName} dapat melanjutkan ujian sekarang.`,
          timer: 1500,
          showConfirmButton: false,
        });
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

        // Broadcast instan ke channel ujian siswa (0ms latency)
        try {
          const cmdChan = supabase.channel(`cbt_exam_cmd_${jadwalId}`);
          cmdChan.send({
            type: 'broadcast',
            event: 'student_block_status',
            payload: {
              sesiId: sesi.id,
              siswaId: sesi.siswa_id,
              status: isBlocking ? 'diblokir' : 'mengerjakan',
            },
          });
        } catch (_bErr) {}

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
  const sedangMengerjakanAktif = displayedSesiList.filter(
    (s) => s.sesi?.status === 'mengerjakan' && isStudentPageOpen(s.id)
  ).length;
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

        {/* Sisi Kanan: 4 Counter KPI (TOTAL, AKTIF, SELESAI, TERBLOKIR) */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end overflow-x-auto pb-1 lg:pb-0">
          <div className="border border-blue-200 bg-blue-50/70 rounded-2xl py-2 px-4 text-center min-w-[85px] shadow-2xs">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">TOTAL</span>
            <span className="text-2xl font-black text-blue-600 block">{totalSiswa}</span>
          </div>
          <div className="border border-emerald-200 bg-emerald-50/70 rounded-2xl py-2 px-4 text-center min-w-[85px] shadow-2xs">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">AKTIF</span>
            <span className="text-2xl font-black text-emerald-600 block">{sedangMengerjakanAktif}</span>
          </div>
          <div className="border border-purple-200 bg-purple-50/70 rounded-2xl py-2 px-4 text-center min-w-[85px] shadow-2xs">
            <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider block">SELESAI</span>
            <span className="text-2xl font-black text-purple-600 block">{sudahSelesai}</span>
          </div>
          <div className="border border-rose-200 bg-rose-50/70 rounded-2xl py-2 px-4 text-center min-w-[85px] shadow-2xs">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">TERBLOKIR</span>
            <span className="text-2xl font-black text-rose-600 block">{diblokir}</span>
          </div>
        </div>
      </div>

      {/* Sub-Bar Filter Ruang, Filter Kelas, Pencarian Nama, & Dokumen Cetak */}
      <div className="bg-white/95 backdrop-blur-sm p-3 rounded-2xl shadow-xs border border-emerald-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Dropdown Ruang */}
          {activeRuangTabs.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Building size={14} className="text-emerald-700 shrink-0" />
              <span className="text-xs font-bold text-slate-600 hidden sm:inline shrink-0">Ruang:</span>
              <select
                value={selectedRuangId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedRuangId(val);
                  const p = {};
                  if (val !== 'semua') p.ruangId = val;
                  if (selectedKelas !== 'semua') p.kelas = selectedKelas;
                  setSearchParams(p);
                }}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-white hover:border-emerald-300 text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition"
              >
                <option value="semua">Semua Ruangan ({sesiList.length})</option>
                {activeRuangTabs.map((tab) => {
                  const count = sesiList.filter((s) => String(s.ruang_id) === String(tab.id)).length;
                  return (
                    <option key={tab.id} value={tab.id}>
                      {tab.nama} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Dropdown Kelas */}
          {distinctKelasList.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-emerald-700 shrink-0" />
              <span className="text-xs font-bold text-slate-600 hidden sm:inline shrink-0">Kelas:</span>
              <select
                value={selectedKelas}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedKelas(val);
                  const p = {};
                  if (selectedRuangId !== 'semua') p.ruangId = selectedRuangId;
                  if (val !== 'semua') p.kelas = val;
                  setSearchParams(p);
                }}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-white hover:border-emerald-300 text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition"
              >
                <option value="semua">
                  Semua Kelas ({selectedRuangId !== 'semua' ? sesiList.filter(s => String(s.ruang_id) === String(selectedRuangId)).length : sesiList.length})
                </option>
                {distinctKelasList.map((k) => {
                  const count = sesiList.filter((s) => {
                    if (selectedRuangId !== 'semua' && String(s.ruang_id) !== String(selectedRuangId)) return false;
                    return s.kelas === k;
                  }).length;
                  return (
                    <option key={k} value={k}>
                      Kelas {k} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Pencarian Nama Siswa / NISN */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px] max-w-sm">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa / NISN..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-emerald-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
                  title="Hapus pencarian"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Dokumen Cetak */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => navigate(`/cbt/cetak/hadir-peserta/${jadwalId}`)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-100 text-slate-700 font-bold text-xs rounded-xl border border-gray-200 shadow-2xs transition"
            title="Cetak Daftar Hadir Peserta"
          >
            <Printer size={13} className="text-slate-500" />
            <span>Hadir Peserta</span>
          </button>
          <button
            onClick={() => navigate(`/cbt/cetak/berita-acara/${jadwalId}`)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-100 text-slate-700 font-bold text-xs rounded-xl border border-gray-200 shadow-2xs transition"
            title="Berita Acara Ujian"
          >
            <FileText size={13} className="text-slate-500" />
            <span>Berita Acara</span>
          </button>
        </div>
      </div>

      {/* Kontrol Pengawasan Serentak (Persis Gambar 1) */}
      <div className="bg-[#0b1329] text-white px-6 py-3.5 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800/90 rounded-xl text-blue-400">
            <Video size={18} />
          </div>
          <div>
            <span className="text-xs font-bold block text-white">Kontrol Pengawasan Serentak</span>
            <span className="text-[10px] text-emerald-400 font-semibold block">
              Berlaku hanya untuk {displayedSesiList.length} siswa dalam filter aktif ({selectedKelas !== 'semua' ? selectedKelas : 'Semua Kelas'} • {selectedRuangId !== 'semua' ? (ruangList.find(r => String(r.id) === String(selectedRuangId))?.nama_ruang || `Ruang ${selectedRuangId}`) : 'Semua Ruangan'})
            </span>
          </div>
        </div>

        {(() => {
          const isAnyPaused = displayedSesiList.some(s => s.sesi?.status === 'dijeda');
          const isAnyRunning = displayedSesiList.some(s => s.sesi?.status === 'mengerjakan');
          const isAnyBlocked = displayedSesiList.some(s => s.sesi?.status === 'diblokir');
          const isAllFinished = displayedSesiList.length > 0 && displayedSesiList.every(s => s.sesi?.status === 'selesai');

          return (
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Pesan Massal (Biru Muda Icon) */}
              <button
                onClick={handleOpenGlobalMsg}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-full border border-slate-700 transition"
              >
                <MessageSquare size={13} className="text-blue-400" />
                <span>Pesan Masal</span>
              </button>

              {/* 2. + Waktu Semua (Hijau Icon) */}
              <button
                onClick={handleAddExtraTimeGlobal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-full border border-slate-700 transition"
              >
                <PlusCircle size={13} className="text-emerald-400" />
                <span>+ Waktu Semua</span>
              </button>

              {/* 3. Jeda / Lanjutkan Semua (Orange / Hijau Icon) */}
              <button
                onClick={() => handleTogglePauseGlobal(isAnyPaused && !isAnyRunning ? 'resume' : 'pause')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 font-semibold text-xs rounded-full border transition ${
                  isAnyPaused && !isAnyRunning
                    ? 'text-emerald-400 border-emerald-500/60'
                    : 'text-amber-400 border-amber-500/60'
                }`}
              >
                {isAnyPaused && !isAnyRunning ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                <span>{isAnyPaused && !isAnyRunning ? 'Lanjutkan Semua' : 'Jeda Semua'}</span>
              </button>

              {/* 4. Blokir / Buka Blokir Semua (Merah / Hijau Icon) */}
              <button
                onClick={handleToggleBlockGlobal}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 font-semibold text-xs rounded-full border transition ${
                  isAnyBlocked && !isAnyRunning
                    ? 'text-emerald-400 border-emerald-500/60'
                    : 'text-rose-400 border-rose-500/60'
                }`}
              >
                {isAnyBlocked && !isAnyRunning ? <Unlock size={13} /> : <Lock size={13} />}
                <span>{isAnyBlocked && !isAnyRunning ? 'Buka Blokir Semua' : 'Blokir Semua'}</span>
              </button>

              {/* 5. Force Selesai / Mulai Lagi Semua (Merah / Biru) */}
              <button
                onClick={handleStopOrRestartGlobal}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-white font-bold text-xs rounded-full shadow transition ${
                  isAllFinished
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-rose-700 hover:bg-rose-800'
                }`}
              >
                {isAllFinished ? <RotateCcw size={13} /> : <Ban size={13} />}
                <span>{isAllFinished ? 'Mulai Lagi Semua' : 'Hentikan Ujian'}</span>
              </button>
            </div>
          );
        })()}
      </div>

      {/* Grid Multi-Card Pengawasan 7 Kolom (Persis Gambar 1) */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : displayedSesiList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 font-medium">
          {searchQuery ? `Tidak ada siswa yang cocok dengan pencarian "${searchQuery}".` : 'Tidak ada peserta ujian pada filter ini.'}
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

            const isPageOpen = isStudentPageOpen(siswa.id);
            const isAktif = isMengerjakan && isPageOpen;

            const statusText = isAktif
              ? 'Aktif'
              : isSelesai
                ? 'Selesai'
                : isDijeda
                  ? 'Dijeda'
                  : isDiblokir
                    ? 'Diblokir'
                    : isMengerjakan
                      ? 'Tidak Aktif'
                      : 'Belum Mulai';

            const liveSisa = getLiveSisaDetik(siswa);
            const waktuText = sesi?.id ? formatTimeWithSeconds(liveSisa) : 'Waktu';

            return (
              <div
                key={siswa.id}
                className={`relative rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 cursor-pointer
                  ${hasLiveVideo && liveFeed.faceStatus !== 'normal'
                    ? 'ring-2 ring-rose-500 ring-offset-1'
                    : hasLiveVideo
                      ? 'ring-1 ring-emerald-400/60'
                      : 'ring-1 ring-gray-200'
                  }`}
                style={{ aspectRatio: '3/4', minHeight: '190px' }}
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
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/75 pointer-events-none" />
                </div>

                {/* ── LAYER 1: Pills Kiri Atas (Kelas & No. Meja - Tidak Tertutup) ── */}
                <div className="absolute top-1.5 left-1.5 flex flex-col items-start gap-1 z-10 pointer-events-none">
                  <span className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-xs">
                    {siswa.kelas || 'Kelas'}
                  </span>
                  <span className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-xs">
                    {siswa.nomor_meja ? `Meja ${siswa.nomor_meja}` : 'Meja -'}
                  </span>
                </div>

                {/* ── LAYER 1: Pills Kanan Atas (Status & Sisa Waktu Berdetik - Tidak Tertutup) ── */}
                <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1 z-10 pointer-events-none">
                  <span className={`text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-xs
                    ${isAktif ? 'bg-emerald-600/90' : isSelesai ? 'bg-purple-700/90' : isDijeda ? 'bg-amber-600/90' : isDiblokir ? 'bg-rose-600/90' : isMengerjakan ? 'bg-slate-600/90' : 'bg-slate-500/80'}`}
                  >
                    {statusText}
                  </span>
                  <span className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-xs font-mono">
                    {waktuText}
                  </span>
                </div>

                {/* Live dot — tengah atas */}
                {hasLiveVideo && (
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 flex h-2 w-2 z-10">
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
                  <div className="flex gap-0.5 mt-1">
                    {/* 1. Pesan (Biru Muda) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setTargetSesi(sesi); setIsMsgModalOpen(true); }}
                      title="Kirim Pesan"
                      className="flex-1 flex items-center justify-center py-1.5 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-600 transition"
                    >
                      <MessageSquare size={13} />
                    </button>
                    {/* 2. Tambah Waktu (Hijau) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAddExtraTime(sesi, studentDisplayName); }}
                      title="Tambah Waktu"
                      className="flex-1 flex items-center justify-center py-1.5 rounded-md bg-[#00e676] hover:bg-green-500 text-white transition"
                    >
                      <PlusCircle size={13} />
                    </button>
                    {/* 3. Jeda / Lanjutkan */}
                    {isDijeda ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTogglePause(sesi); }}
                        title="Lanjutkan"
                        className="flex-1 flex items-center justify-center py-1.5 rounded-md bg-[#16a34a] hover:bg-green-700 text-white transition"
                      >
                        <PlayCircle size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTogglePause(sesi); }}
                        title="Jeda"
                        className="flex-1 flex items-center justify-center py-1.5 rounded-md bg-[#ff9100] hover:bg-orange-500 text-white transition"
                      >
                        <PauseCircle size={13} />
                      </button>
                    )}
                    {/* 4. Blokir / Buka Blokir (Gembok Terbuka Hijau / Gembok Tertutup Merah) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleBlock(sesi); }}
                      title={isBlocked ? 'Buka Blokir' : 'Blokir'}
                      className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition shadow-xs ${isBlocked
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                    >
                      {isBlocked ? <Lock size={13} /> : <Unlock size={13} />}
                    </button>
                    {/* 5. Force Selesai / Mulai Lagi (Panah Melingkar untuk Selesai) */}
                    {isSelesai ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestartSingle(sesi, studentDisplayName); }}
                        title="Mulai Lagi Ujian"
                        className="flex-1 flex items-center justify-center py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs"
                      >
                        <RotateCcw size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStopSingle(sesi); }}
                        title="Hentikan Ujian"
                        className="flex-1 flex items-center justify-center py-1.5 rounded-md bg-[#be123c] hover:bg-rose-800 text-white transition"
                      >
                        <Ban size={13} />
                      </button>
                    )}
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
                  onClick={() => handleAddExtraTime(previewStudent.sesi, previewStudent.nama || previewStudent.nama_lengkap)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  <PlusCircle size={13} />
                  <span>Tambah Waktu</span>
                </button>
                <button
                  onClick={() => handleToggleBlock(previewStudent.sesi)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${previewStudent.sesi?.status === 'diblokir'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                >
                  {previewStudent.sesi?.status === 'diblokir' ? <Lock size={13} /> : <Unlock size={13} />}
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
