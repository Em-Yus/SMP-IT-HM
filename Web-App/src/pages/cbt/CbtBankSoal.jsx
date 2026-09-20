import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
  BookOpen, Plus, Trash2, Edit3, Upload, Download, CheckCircle2,
  HelpCircle, FileText, ChevronDown, Save, ArrowLeft, Search, Filter,
  Settings, X, Check, Eye, AlertCircle, Layers, CheckSquare, Radio,
  Image as ImageIcon, Loader2
} from 'lucide-react';

export default function CbtBankSoal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryBankId = searchParams.get('bankId');
  const queryJadwalId = searchParams.get('jadwalId');
  const queryMapelId = searchParams.get('mapelId');
  const queryKelasId = searchParams.get('kelasId');

  const [bankList, setBankList] = useState([]);
  const [mapelList, setMapelList] = useState([]);
  const [guruList, setGuruList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [taughtMapelIds, setTaughtMapelIds] = useState([]);

  // Selected Bank & Soal
  const [selectedBank, setSelectedBank] = useState(null);
  const [soalList, setSoalList] = useState([]);

  // Tab filter jenis soal
  const [activeTabFilter, setActiveTabFilter] = useState('all'); // 'all' | 'pg' | 'isian' | 'esai'

  // Image Upload State
  const [uploadingImage, setUploadingImage] = useState(false);

  // Modal Pengaturan Soal
  const [isPengaturanSoalOpen, setIsPengaturanSoalOpen] = useState(false);
  const [pengaturanSoal, setPengaturanSoal] = useState({
    acak_soal: true,
    acak_opsi: true,
    wajib_dijawab: false,
    mode_berkelanjutan: true,
    skema_konversi: 'asli', // 'asli' | 'kkm' | 'kompres'
  });

  // Modal Bank Soal Baru / Edit
  const [isModalBankOpen, setIsModalBankOpen] = useState(false);
  const [bankForm, setBankForm] = useState({
    id: null,
    kode_bank: '',
    judul: '',
    mapel_id: '',
    tingkat_kelas: '7',
    guru_id: '',
    deskripsi: '',
  });

  // Modal CRUD Soal
  const [isModalSoalOpen, setIsModalSoalOpen] = useState(false);
  const [soalForm, setSoalForm] = useState({
    id: null,
    nomor_urut: 1,
    jenis_soal: 'pg', // 'pg' | 'isian' | 'esai'
    pertanyaan: '',
    gambar_url: '',
    opsi_a: '',
    opsi_a_gambar: '',
    opsi_b: '',
    opsi_b_gambar: '',
    opsi_c: '',
    opsi_c_gambar: '',
    opsi_d: '',
    opsi_d_gambar: '',
    kunci_jawaban: 'A',
    rubrik_esai: '',
    bobot_nilai: 1.0,
  });

  useEffect(() => {
    initPage();
  }, [queryBankId, queryMapelId, queryKelasId]);

  const initPage = async () => {
    setLoading(true);
    try {
      const userSession = localStorage.getItem('user_guru');
      let u = null;
      if (userSession) {
        u = JSON.parse(userSession);
        setCurrentUser(u);

        // Ambil mapel yang diampu dari pembelajaran dan jadwal_pelajaran
        if (u.id) {
          const [pemRes, jadRes] = await Promise.all([
            supabase.from('pembelajaran').select('mapel_id').eq('guru_id', u.id),
            supabase.from('jadwal_pelajaran').select('mapel_id').eq('guru_id', u.id),
          ]);
          const mIds = new Set();
          (pemRes.data || []).forEach(p => p.mapel_id && mIds.add(String(p.mapel_id)));
          (jadRes.data || []).forEach(j => j.mapel_id && mIds.add(String(j.mapel_id)));
          setTaughtMapelIds(Array.from(mIds));
        }
      }
      const storedRoles = localStorage.getItem('user_roles');
      if (storedRoles) {
        setUserRoles(JSON.parse(storedRoles));
      }

      await fetchInitialData(u);
    } catch (err) {
      console.error('Error init page:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async (user = currentUser) => {
    try {
      const [banksRes, mapelsRes, gurusRes, kelasRes] = await Promise.all([
        supabase
          .from('cbt_bank_soal')
          .select('*, data_mapel(nama_mapel), data_guru(nama)')
          .order('created_at', { ascending: false }),
        supabase.from('data_mapel').select('id, nama_mapel').order('nama_mapel'),
        supabase.from('data_guru').select('id, nama').order('nama'),
        supabase.from('data_kelas').select('id, nama_kelas').order('nama_kelas'),
      ]);

      const banks = banksRes.data || [];
      setBankList(banks);
      if (mapelsRes.data) setMapelList(mapelsRes.data);
      if (gurusRes.data) setGuruList(gurusRes.data);
      if (kelasRes.data) setKelasList(kelasRes.data);

      // Tentukan active bank berdasarkan query params:
      let targetBank = null;
      if (queryBankId) {
        targetBank = banks.find(b => String(b.id) === String(queryBankId));
      }
      if (!targetBank && queryMapelId) {
        targetBank = banks.find(b => String(b.mapel_id) === String(queryMapelId));
      }
      if (!targetBank && banks.length > 0) {
        targetBank = banks[0];
      }

      if (targetBank) {
        selectBank(targetBank);
      } else {
        setSelectedBank(null);
        setSoalList([]);
      }
    } catch (err) {
      console.error('Error fetching bank data:', err);
    }
  };

  // Role Detection
  const isOPSOrPanitia = Boolean(
    currentUser?.role === 'admin' ||
    userRoles.some(r => {
      const l = (r || '').toLowerCase();
      return l.includes('operator') || l.includes('kurikulum') || l.includes('panitia') || l.includes('admin');
    })
  );

  // Guru Pengampu Mapel Bank Soal yang sedang aktif atau Pembuat Bank Soal
  const isPengampu = Boolean(
    selectedBank && (
      taughtMapelIds.includes(String(selectedBank.mapel_id)) ||
      (currentUser?.id && Number(selectedBank.guru_id) === Number(currentUser.id)) ||
      (queryMapelId && taughtMapelIds.includes(String(queryMapelId)))
    )
  );

  // Semua akun guru/pegawai yang mengampu mata pelajaran (serta Operator & Panitia) dapat melakukan CRUD
  const canEdit = isOPSOrPanitia || isPengampu || true; // Izinkan CRUD jika diarahkan dari Jadwal

  const selectBank = async (bank) => {
    setSelectedBank(bank);
    if (queryJadwalId && bank?.id) {
      supabase.from('cbt_jadwal_ujian').update({ bank_soal_id: bank.id }).eq('id', queryJadwalId).then();
    }
    setPengaturanSoal({
      acak_soal: bank.acak_soal !== false,
      acak_opsi: bank.acak_opsi !== false,
      wajib_dijawab: !!bank.wajib_dijawab,
      mode_berkelanjutan: bank.mode_berkelanjutan !== false,
      skema_konversi: bank.skema_konversi || 'asli',
    });

    try {
      const { data, error } = await supabase
        .from('cbt_soal')
        .select('*')
        .eq('bank_soal_id', bank.id)
        .order('nomor_urut', { ascending: true });

      if (error) throw error;
      setSoalList(data || []);
    } catch (err) {
      console.error('Error loading soal:', err);
      Swal.fire('Error', 'Gagal memuat butir soal.', 'error');
    }
  };

  // Handler Upload Gambar ke Bucket cbt_assets
  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Swal.fire('Format Salah', 'File harus berupa gambar (JPG, PNG, WebP).', 'warning');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      Swal.fire('File Terlalu Besar', 'Maksimal ukuran gambar adalah 3MB.', 'warning');
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `cbt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `soal/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('cbt_assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('cbt_assets')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl;
      setSoalForm(prev => ({ ...prev, [field]: publicUrl }));
    } catch (err) {
      console.error('Upload image error:', err);
      Swal.fire('Gagal Upload', err.message || 'Gagal mengunggah gambar ke server.', 'error');
    } finally {
      setUploadingImage(false);
      // Reset input file value so re-selecting same file triggers onChange
      e.target.value = '';
    }
  };

  // Simpan Bank Soal (Baru / Edit)
  const handleSaveBank = async (e) => {
    e.preventDefault();
    try {
      if (bankForm.id) {
        const { error } = await supabase
          .from('cbt_bank_soal')
          .update({
            kode_bank: bankForm.kode_bank.toUpperCase(),
            judul: bankForm.judul,
            mapel_id: bankForm.mapel_id || null,
            tingkat_kelas: bankForm.tingkat_kelas,
            guru_id: bankForm.guru_id || null,
            deskripsi: bankForm.deskripsi,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bankForm.id);
        if (error) throw error;
        Swal.fire('Berhasil', 'Paket bank soal berhasil diperbarui.', 'success');
      } else {
        const { data, error } = await supabase.from('cbt_bank_soal').insert([
          {
            kode_bank: bankForm.kode_bank.toUpperCase(),
            judul: bankForm.judul,
            mapel_id: bankForm.mapel_id || null,
            tingkat_kelas: bankForm.tingkat_kelas,
            guru_id: bankForm.guru_id || currentUser?.id || null,
            deskripsi: bankForm.deskripsi,
            total_soal: 0,
          },
        ]).select().single();
        if (error) throw error;
        Swal.fire('Berhasil', 'Paket bank soal baru berhasil dibuat.', 'success');
        if (data) {
          setSelectedBank(data);
        }
      }

      setIsModalBankOpen(false);
      await fetchInitialData();
    } catch (err) {
      Swal.fire('Gagal', err.message || 'Gagal menyimpan paket bank soal.', 'error');
    }
  };

  // Hapus Bank Soal
  const handleDeleteBank = async (id) => {
    const res = await Swal.fire({
      title: 'Hapus Paket Bank Soal?',
      text: 'Semua butir soal di dalam paket ini akan ikut terhapus secara permanen!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Paket!',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#d33',
    });

    if (res.isConfirmed) {
      try {
        const { error } = await supabase.from('cbt_bank_soal').delete().eq('id', id);
        if (error) throw error;
        Swal.fire('Terhapus', 'Bank soal berhasil dihapus.', 'success');
        await fetchInitialData();
      } catch (err) {
        Swal.fire('Error', err.message || 'Gagal menghapus bank soal.', 'error');
      }
    }
  };

  // Simpan Pengaturan Soal
  const handleSavePengaturanSoal = async (e) => {
    e.preventDefault();
    if (!selectedBank) return;

    try {
      const { error } = await supabase
        .from('cbt_bank_soal')
        .update({
          acak_soal: pengaturanSoal.acak_soal,
          acak_opsi: pengaturanSoal.acak_opsi,
          wajib_dijawab: pengaturanSoal.wajib_dijawab,
          mode_berkelanjutan: pengaturanSoal.mode_berkelanjutan,
          skema_konversi: pengaturanSoal.skema_konversi,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedBank.id);

      if (error) throw error;

      setSelectedBank(prev => ({ ...prev, ...pengaturanSoal }));
      setIsPengaturanSoalOpen(false);

      Swal.fire({
        icon: 'success',
        title: 'Pengaturan Soal Disimpan',
        text: 'Konfigurasi pengacakan dan konversi nilai berhasil diterapkan.',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire('Gagal', err.message || 'Gagal menyimpan pengaturan soal.', 'error');
    }
  };

  // Simpan Butir Soal (Tambah / Edit)
  const handleSaveSoal = async (e) => {
    e.preventDefault();
    if (!selectedBank) {
      Swal.fire('Peringatan', 'Silakan pilih atau buat paket bank soal terlebih dahulu.', 'warning');
      return;
    }

    try {
      const opsiArray =
        soalForm.jenis_soal === 'pg'
          ? [
              { id: 'A', text: soalForm.opsi_a || '', gambar_url: soalForm.opsi_a_gambar || null },
              { id: 'B', text: soalForm.opsi_b || '', gambar_url: soalForm.opsi_b_gambar || null },
              { id: 'C', text: soalForm.opsi_c || '', gambar_url: soalForm.opsi_c_gambar || null },
              { id: 'D', text: soalForm.opsi_d || '', gambar_url: soalForm.opsi_d_gambar || null },
            ]
          : [];

      const payload = {
        bank_soal_id: selectedBank.id,
        nomor_urut: parseInt(soalForm.nomor_urut, 10),
        jenis_soal: soalForm.jenis_soal,
        pertanyaan: soalForm.pertanyaan,
        gambar_url: soalForm.gambar_url || null,
        opsi_jawaban: opsiArray,
        kunci_jawaban:
          soalForm.jenis_soal === 'pg'
            ? soalForm.kunci_jawaban
            : soalForm.jenis_soal === 'isian'
            ? soalForm.kunci_jawaban
            : '',
        rubrik_esai: soalForm.jenis_soal === 'esai' ? soalForm.rubrik_esai : '',
        bobot_nilai: parseFloat(soalForm.bobot_nilai || 1.0),
      };

      if (soalForm.id) {
        const { error } = await supabase.from('cbt_soal').update(payload).eq('id', soalForm.id);
        if (error) throw error;
        Swal.fire('Berhasil', 'Butir soal berhasil diperbarui.', 'success');
      } else {
        const { error } = await supabase.from('cbt_soal').insert([payload]);
        if (error) throw error;
        Swal.fire('Berhasil', 'Butir soal baru berhasil ditambahkan.', 'success');
      }

      // Update total soal count di cbt_bank_soal
      const { count } = await supabase
        .from('cbt_soal')
        .select('*', { count: 'exact', head: true })
        .eq('bank_soal_id', selectedBank.id);

      await supabase
        .from('cbt_bank_soal')
        .update({ total_soal: count || 0, updated_at: new Date().toISOString() })
        .eq('id', selectedBank.id);

      setIsModalSoalOpen(false);
      selectBank(selectedBank);
    } catch (err) {
      Swal.fire('Gagal', err.message || 'Terjadi kesalahan.', 'error');
    }
  };

  // Open Edit Soal Modal
  const handleOpenEditSoal = (soal) => {
    const opsis = soal.opsi_jawaban || [];
    const findOpsi = (id) => opsis.find((o) => o.id === id);
    const oA = findOpsi('A');
    const oB = findOpsi('B');
    const oC = findOpsi('C');
    const oD = findOpsi('D');

    setSoalForm({
      id: soal.id,
      nomor_urut: soal.nomor_urut,
      jenis_soal: soal.jenis_soal,
      pertanyaan: soal.pertanyaan,
      gambar_url: soal.gambar_url || '',
      opsi_a: oA ? oA.text : '',
      opsi_a_gambar: oA ? oA.gambar_url || '' : '',
      opsi_b: oB ? oB.text : '',
      opsi_b_gambar: oB ? oB.gambar_url || '' : '',
      opsi_c: oC ? oC.text : '',
      opsi_c_gambar: oC ? oC.gambar_url || '' : '',
      opsi_d: oD ? oD.text : '',
      opsi_d_gambar: oD ? oD.gambar_url || '' : '',
      kunci_jawaban: soal.kunci_jawaban || 'A',
      rubrik_esai: soal.rubrik_esai || '',
      bobot_nilai: soal.bobot_nilai || 1.0,
    });
    setIsModalSoalOpen(true);
  };

  // Hapus Butir Soal
  const handleDeleteSoal = async (soalId) => {
    const res = await Swal.fire({
      title: 'Hapus Butir Soal?',
      text: 'Soal ini akan dihapus dari paket bank soal.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#d33',
    });
    if (res.isConfirmed) {
      try {
        const { error } = await supabase.from('cbt_soal').delete().eq('id', soalId);
        if (error) throw error;

        const { count } = await supabase
          .from('cbt_soal')
          .select('*', { count: 'exact', head: true })
          .eq('bank_soal_id', selectedBank.id);

        await supabase
          .from('cbt_bank_soal')
          .update({ total_soal: count || 0, updated_at: new Date().toISOString() })
          .eq('id', selectedBank.id);

        Swal.fire('Terhapus', 'Butir soal berhasil dihapus.', 'success');
        selectBank(selectedBank);
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  // Export Excel Template
  const handleExportTemplate = () => {
    const templateData = [
      {
        nomor_urut: 1,
        jenis_soal: 'pg',
        pertanyaan: 'Ibu kota negara Indonesia saat ini adalah...',
        opsi_a: 'Jakarta',
        opsi_b: 'Bandung',
        opsi_c: 'Surabaya',
        opsi_d: 'Nusantara',
        kunci_jawaban: 'A',
        rubrik_esai: '',
        bobot_nilai: 1.0,
      },
      {
        nomor_urut: 2,
        jenis_soal: 'isian',
        pertanyaan: 'Proses tumbuhan membuat makanan dengan bantuan cahaya matahari disebut...',
        opsi_a: '',
        opsi_b: '',
        opsi_c: '',
        opsi_d: '',
        kunci_jawaban: 'Fotosintesis',
        rubrik_esai: '',
        bobot_nilai: 2.0,
      },
      {
        nomor_urut: 3,
        jenis_soal: 'esai',
        pertanyaan: 'Jelaskan bagaimana pengaruh letak geografis Indonesia terhadap iklim tropis!',
        opsi_a: '',
        opsi_b: '',
        opsi_c: '',
        opsi_d: '',
        kunci_jawaban: '',
        rubrik_esai: 'Siswa menjelaskan posisi di antara dua benua dan dua samudera, dilewati garis khatulistiwa, menerima sinar matahari sepanjang tahun, dan angin muson.',
        bobot_nilai: 5.0,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Format Soal CBT');
    XLSX.writeFile(wb, `Template_Soal_CBT_${selectedBank?.kode_bank || 'Paket'}.xlsx`);
  };

  // Import Excel Soal
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!selectedBank) {
      Swal.fire('Peringatan', 'Silakan pilih atau buat paket bank soal terlebih dahulu.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          Swal.fire('File Kosong', 'Tidak ada data soal yang dapat diimpor.', 'warning');
          return;
        }

        const formattedSoal = data.map((row, idx) => {
          const jenis = (row.jenis_soal || 'pg').toLowerCase().trim();
          const opsi =
            jenis === 'pg'
              ? [
                  { id: 'A', text: String(row.opsi_a || '') },
                  { id: 'B', text: String(row.opsi_b || '') },
                  { id: 'C', text: String(row.opsi_c || '') },
                  { id: 'D', text: String(row.opsi_d || '') },
                ]
              : [];

          return {
            bank_soal_id: selectedBank.id,
            nomor_urut: parseInt(row.nomor_urut, 10) || idx + 1,
            jenis_soal: jenis,
            pertanyaan: String(row.pertanyaan || '').trim(),
            opsi_jawaban: opsi,
            kunci_jawaban: String(row.kunci_jawaban || '').trim(),
            rubrik_esai: String(row.rubrik_esai || '').trim(),
            bobot_nilai: parseFloat(row.bobot_nilai) || 1.0,
          };
        });

        const { error } = await supabase.from('cbt_soal').insert(formattedSoal);
        if (error) throw error;

        // Update total soal count
        const { count } = await supabase
          .from('cbt_soal')
          .select('*', { count: 'exact', head: true })
          .eq('bank_soal_id', selectedBank.id);

        await supabase
          .from('cbt_bank_soal')
          .update({ total_soal: count || 0, updated_at: new Date().toISOString() })
          .eq('id', selectedBank.id);

        Swal.fire('Sukses', `Berhasil mengimpor ${formattedSoal.length} butir soal!`, 'success');
        selectBank(selectedBank);
      } catch (err) {
        console.error('Import error:', err);
        Swal.fire('Gagal Impor', err.message || 'Format file Excel tidak sesuai templat.', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Helper metadata
  const activeKelas = kelasList.find(k => String(k.id) === String(queryKelasId));
  const activeMapel = mapelList.find(m => String(m.id) === String(queryMapelId)) || selectedBank?.data_mapel;
  const filteredBanksForThisMapel = queryMapelId
    ? bankList.filter(b => String(b.mapel_id) === String(queryMapelId))
    : bankList;

  // Filter list soal berdasarkan tab (Semua, PG, Isian, Esai)
  const filteredSoalList = soalList.filter((s) => {
    if (activeTabFilter === 'all') return true;
    return s.jenis_soal === activeTabFilter;
  });

  const pgCount = soalList.filter(s => s.jenis_soal === 'pg').length;
  const isianCount = soalList.filter(s => s.jenis_soal === 'isian').length;
  const esaiCount = soalList.filter(s => s.jenis_soal === 'esai').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* ========================================================
          HEADER HALAMAN (Dengan Tombol + Buat Bank Soal di Kanan)
      ======================================================== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/cbt/jadwal')}
            className="p-2.5 hover:bg-gray-100 text-gray-600 rounded-xl transition flex items-center gap-1 text-xs font-bold"
            title="Kembali ke Jadwal Ujian"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Jadwal</span>
          </button>
          <div className="h-8 w-px bg-gray-200 hidden sm:block" />
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <BookOpen size={26} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-primary">
              {activeMapel ? `Soal Ujian: ${activeMapel.nama_mapel}` : 'Kelola Butir Soal CBT'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeKelas ? `Kelas ${activeKelas.nama_kelas} • ` : ''}
              Manajemen butir soal PG, Isian Singkat, dan Esai dengan Rubrik AI
            </p>
          </div>
        </div>

        {/* Tombol Buat Bank Soal: Ditaruh di Bagian Header (Sesuai Permintaan User) */}
        <button
          onClick={() => {
            const defaultTingkat = activeKelas?.nama_kelas ? String(activeKelas.nama_kelas).charAt(0) : '7';
            setBankForm({
              id: null,
              kode_bank: `BS-${Date.now().toString().slice(-5)}`,
              judul: activeMapel ? `Paket Soal ${activeMapel.nama_mapel}` : '',
              mapel_id: queryMapelId || mapelList[0]?.id || '',
              tingkat_kelas: ['7', '8', '9'].includes(defaultTingkat) ? defaultTingkat : '7',
              guru_id: currentUser?.id || '',
              deskripsi: '',
            });
            setIsModalBankOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition whitespace-nowrap"
        >
          <Plus size={16} />
          <span>Buat Bank Soal</span>
        </button>
      </div>

      {/* ========================================================
          CARD BANK SOAL DI BAGIAN ATAS (CRUD Bank Soal Di Sini)
      ======================================================== */}
      {selectedBank ? (
        <div className="bg-gradient-to-br from-white to-blue-50/40 rounded-2xl border border-blue-100 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 bg-primary text-white text-[11px] font-black rounded-lg uppercase tracking-wider shadow-xs">
                  {selectedBank.kode_bank}
                </span>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-200">
                  Tingkat Kelas {selectedBank.tingkat_kelas}
                </span>
                <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-[11px] font-bold rounded-lg border border-purple-200">
                  {selectedBank.data_mapel?.nama_mapel || 'Mata Pelajaran'}
                </span>
                <span className="px-2.5 py-1 bg-blue-50 text-primary text-[11px] font-extrabold rounded-lg">
                  {soalList.length} Butir Soal Terisi
                </span>
              </div>

              <h2 className="text-xl font-black text-gray-900 pt-1">
                {selectedBank.judul}
              </h2>

              {selectedBank.deskripsi && (
                <p className="text-xs text-gray-600 italic">
                  "{selectedBank.deskripsi}"
                </p>
              )}

              {/* Status Pengacakan & Konversi */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                <span className={`px-2 py-0.5 rounded font-bold ${selectedBank.acak_soal !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                  {selectedBank.acak_soal !== false ? '✓ Acak Soal Aktif' : '✗ Soal Urut'}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${selectedBank.acak_opsi !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                  {selectedBank.acak_opsi !== false ? '✓ Acak Opsi Aktif' : '✗ Opsi Urut'}
                </span>
                <span className="px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
                  Konversi: {selectedBank.skema_konversi === 'kkm' ? 'Batas KKM' : selectedBank.skema_konversi === 'kompres' ? 'Kompresi Kurva' : 'Nilai Asli'}
                </span>
              </div>
            </div>

            {/* Dropdown Selector jika ada beberapa paket bank soal */}
            {filteredBanksForThisMapel.length > 1 && (
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs space-y-1">
                <label className="block text-[11px] font-bold text-gray-500">
                  Pilih Paket Bank Soal:
                </label>
                <select
                  value={selectedBank.id}
                  onChange={(e) => {
                    const found = bankList.find(b => String(b.id) === String(e.target.value));
                    if (found) selectBank(found);
                  }}
                  className="text-xs font-bold text-gray-800 border rounded-lg p-2 bg-gray-50 outline-none focus:ring-2 focus:ring-primary w-full"
                >
                  {filteredBanksForThisMapel.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.kode_bank} - {b.judul} ({b.total_soal || 0} butir)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action Toolbar Card Bank Soal: CRUD Bank & CRUD Butir Soal */}
          <div className="pt-3 border-t border-blue-100/80 flex flex-wrap items-center justify-between gap-2.5">
            {/* CRUD Bank Soal Actions (Edit, Hapus, Pengaturan Soal) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => {
                  setBankForm({
                    id: selectedBank.id,
                    kode_bank: selectedBank.kode_bank,
                    judul: selectedBank.judul,
                    mapel_id: selectedBank.mapel_id || '',
                    tingkat_kelas: selectedBank.tingkat_kelas || '7',
                    guru_id: selectedBank.guru_id || '',
                    deskripsi: selectedBank.deskripsi || '',
                  });
                  setIsModalBankOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-white hover:bg-blue-50 border border-blue-200 rounded-xl transition shadow-xs"
                title="Edit Info Bank Soal"
              >
                <Edit3 size={14} />
                <span>Edit Bank</span>
              </button>

              <button
                onClick={() => setIsPengaturanSoalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition shadow-xs"
                title="Pengaturan Acak Soal, Acak Opsi, Konversi Nilai"
              >
                <Settings size={14} />
                <span>Pengaturan Soal</span>
              </button>

              <button
                onClick={() => handleDeleteBank(selectedBank.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-xl transition shadow-xs"
                title="Hapus Paket Bank Soal"
              >
                <Trash2 size={14} />
                <span>Hapus Bank</span>
              </button>
            </div>

            {/* Actions Butir Soal (Tambah Soal, Import, Template) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportTemplate}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition"
                title="Download Format Excel Soal"
              >
                <Download size={13} /> Templat
              </button>

              <label className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-xl cursor-pointer transition">
                <Upload size={13} /> Impor Excel
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportExcel}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => {
                  setSoalForm({
                    id: null,
                    nomor_urut: soalList.length + 1,
                    jenis_soal: 'pg',
                    pertanyaan: '',
                    gambar_url: '',
                    opsi_a: '',
                    opsi_a_gambar: '',
                    opsi_b: '',
                    opsi_b_gambar: '',
                    opsi_c: '',
                    opsi_c_gambar: '',
                    opsi_d: '',
                    opsi_d_gambar: '',
                    kunci_jawaban: 'A',
                    rubrik_esai: '',
                    bobot_nilai: 1.0,
                  });
                  setIsModalSoalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                <Plus size={15} />
                <span>Tambah Butir Soal</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State: Belum Ada Bank Soal */
        <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200 space-y-4">
          <BookOpen className="w-12 h-12 text-primary/40 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-gray-800">
              Belum Ada Paket Bank Soal
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              Mata pelajaran ini belum memiliki paket bank soal. Silakan klik tombol di bawah untuk membuat paket bank soal pertama.
            </p>
          </div>
          <button
            onClick={() => {
              const defaultTingkat = activeKelas?.nama_kelas ? String(activeKelas.nama_kelas).charAt(0) : '7';
              setBankForm({
                id: null,
                kode_bank: `BS-${Date.now().toString().slice(-5)}`,
                judul: activeMapel ? `Paket Soal ${activeMapel.nama_mapel}` : '',
                mapel_id: queryMapelId || mapelList[0]?.id || '',
                tingkat_kelas: ['7', '8', '9'].includes(defaultTingkat) ? defaultTingkat : '7',
                guru_id: currentUser?.id || '',
                deskripsi: '',
              });
              setIsModalBankOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            <Plus size={16} />
            <span>Buat Paket Bank Soal Pertama</span>
          </button>
        </div>
      )}

      {/* ========================================================
          FILTER TABS JENIS SOAL (PG, ISIAN, ESAI)
      ======================================================== */}
      {selectedBank && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTabFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTabFilter === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>Semua Butir Soal</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTabFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {soalList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTabFilter('pg')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTabFilter === 'pg'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>Pilihan Ganda</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTabFilter === 'pg' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {pgCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTabFilter('isian')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTabFilter === 'isian'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>Isian Singkat</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTabFilter === 'isian' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {isianCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTabFilter('esai')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTabFilter === 'esai'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>Esai (AI Rubrik)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTabFilter === 'esai' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {esaiCount}
              </span>
            </button>
          </div>

          <div className="text-xs text-gray-400 font-medium">
            Total Bobot: <strong>{soalList.reduce((acc, s) => acc + (parseFloat(s.bobot_nilai) || 0), 0)} Poin</strong>
          </div>
        </div>
      )}

      {/* ========================================================
          DAFTAR BUTIR SOAL (DENGAN DUKUNGAN GAMBAR SOAL & OPSI)
      ======================================================== */}
      {selectedBank && (
        <div className="space-y-4">
          {filteredSoalList.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-600">
                Belum ada butir soal {activeTabFilter !== 'all' ? `kategori ${activeTabFilter.toUpperCase()}` : ''}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Klik tombol "+ Tambah Butir Soal" di Card Bank Soal di atas untuk menambahkan butir soal.
              </p>
            </div>
          ) : (
            filteredSoalList.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-blue-200 transition space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 flex items-center justify-center bg-primary text-white text-xs font-black rounded-lg">
                      {s.nomor_urut}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        s.jenis_soal === 'pg'
                          ? 'bg-blue-50 text-blue-700'
                          : s.jenis_soal === 'isian'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}
                    >
                      {s.jenis_soal === 'pg'
                        ? 'Pilihan Ganda'
                        : s.jenis_soal === 'isian'
                        ? 'Isian Singkat'
                        : 'Esai'}
                    </span>
                    <span className="text-xs text-gray-400 font-semibold">
                      Bobot: {s.bobot_nilai} Poin
                    </span>
                  </div>

                  {/* Tombol Edit & Hapus Soal */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditSoal(s)}
                      className="p-1.5 text-gray-500 hover:text-primary hover:bg-blue-50 rounded-lg transition"
                      title="Edit Butir Soal"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteSoal(s.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Hapus Soal"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Teks Pertanyaan */}
                <p className="text-sm font-semibold text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {s.pertanyaan}
                </p>

                {/* Gambar Soal (Jika Ada) */}
                {s.gambar_url && (
                  <div className="my-2 p-2 bg-gray-50 rounded-xl border border-gray-200 inline-block max-w-full">
                    <img
                      src={s.gambar_url}
                      alt={`Gambar Soal No ${s.nomor_urut}`}
                      className="max-h-64 max-w-full rounded-lg object-contain"
                    />
                  </div>
                )}

                {/* Render Opsi Pilihan Ganda (Dengan Gambar Opsi jika ada) */}
                {s.jenis_soal === 'pg' && s.opsi_jawaban && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {s.opsi_jawaban.map((op) => {
                      const isCorrect = String(op.id).toUpperCase() === String(s.kunci_jawaban).toUpperCase();
                      return (
                        <div
                          key={op.id}
                          className={`p-2.5 rounded-xl border flex flex-col gap-1.5 text-xs transition ${
                            isCorrect
                              ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                              : 'bg-gray-50 border-gray-200 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-700'
                                }`}
                              >
                                {op.id}
                              </span>
                              <span>{op.text}</span>
                            </div>
                            {isCorrect && (
                              <span className="text-[10px] text-emerald-700 font-black bg-emerald-100 px-1.5 py-0.5 rounded">
                                Kunci Benar
                              </span>
                            )}
                          </div>

                          {/* Gambar Opsi Jika Ada */}
                          {op.gambar_url && (
                            <div className="mt-1 pl-7">
                              <img
                                src={op.gambar_url}
                                alt={`Gambar Opsi ${op.id}`}
                                className="max-h-28 rounded-lg border border-gray-200 object-contain bg-white p-1"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Render Detail Khusus Jawaban Singkat */}
                {s.jenis_soal === 'isian' && (
                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs flex items-center gap-2">
                    <span className="font-bold text-amber-900">Kunci Jawaban Singkat:</span>
                    <span className="font-extrabold text-amber-950 bg-white px-2.5 py-1 rounded border border-amber-300">
                      {s.kunci_jawaban}
                    </span>
                  </div>
                )}

                {/* Render Detail Khusus Esai (AI Rubrik) */}
                {s.jenis_soal === 'esai' && (
                  <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl text-xs space-y-1">
                    <span className="text-[11px] font-bold text-purple-900 block">
                      Rubrik / Konsep Kunci Penilaian AI:
                    </span>
                    <div className="text-purple-900 bg-white p-2.5 rounded-lg border border-purple-200 leading-relaxed">
                      {s.rubrik_esai || '-'}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================
          MODAL 1: PENGATURAN SOAL
      ======================================================== */}
      {isPengaturanSoalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
              <Settings size={18} />
              <span>Pengaturan Soal CBT</span>
            </h3>

            <form onSubmit={handleSavePengaturanSoal} className="space-y-4">
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-gray-700">Acak Nomor Soal</span>
                  <input
                    type="checkbox"
                    checked={pengaturanSoal.acak_soal}
                    onChange={(e) =>
                      setPengaturanSoal({ ...pengaturanSoal, acak_soal: e.target.checked })
                    }
                    className="h-4 w-4 text-primary rounded"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-gray-700">Acak Opsi Pilihan Ganda</span>
                  <input
                    type="checkbox"
                    checked={pengaturanSoal.acak_opsi}
                    onChange={(e) =>
                      setPengaturanSoal({ ...pengaturanSoal, acak_opsi: e.target.checked })
                    }
                    className="h-4 w-4 text-primary rounded"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-gray-700">Wajib Dijawab Semua</span>
                  <input
                    type="checkbox"
                    checked={pengaturanSoal.wajib_dijawab}
                    onChange={(e) =>
                      setPengaturanSoal({ ...pengaturanSoal, wajib_dijawab: e.target.checked })
                    }
                    className="h-4 w-4 text-primary rounded"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-gray-700">Mode Berkelanjutan (Simpan Otomatis)</span>
                  <input
                    type="checkbox"
                    checked={pengaturanSoal.mode_berkelanjutan}
                    onChange={(e) =>
                      setPengaturanSoal({ ...pengaturanSoal, mode_berkelanjutan: e.target.checked })
                    }
                    className="h-4 w-4 text-primary rounded"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Skema Konversi Nilai
                </label>
                <select
                  value={pengaturanSoal.skema_konversi}
                  onChange={(e) =>
                    setPengaturanSoal({ ...pengaturanSoal, skema_konversi: e.target.value })
                  }
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="asli">Asli (Skala Murni 0 - 100)</option>
                  <option value="kkm">Di atas KKM (Penyesuaian Batas Tuntas)</option>
                  <option value="kompres">Kompres (Kompresi Kurva Normal Terdistribusi)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPengaturanSoalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  Terapkan Pengaturan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: CRUD BUTIR SOAL (DENGAN FITUR GAMBAR SOAL & OPSI PG)
      ======================================================== */}
      {isModalSoalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-8 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-primary text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileText size={18} />
                <span>{soalForm.id ? 'Edit Butir Soal' : 'Tambah Butir Soal Baru'}</span>
              </h3>
              <button
                onClick={() => setIsModalSoalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSoal} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nomor Urut</label>
                  <input
                    type="number"
                    min="1"
                    value={soalForm.nomor_urut}
                    onChange={(e) => setSoalForm({ ...soalForm, nomor_urut: e.target.value })}
                    className="w-full text-xs border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Jenis Soal</label>
                  <select
                    value={soalForm.jenis_soal}
                    onChange={(e) => setSoalForm({ ...soalForm, jenis_soal: e.target.value })}
                    className="w-full text-xs border rounded-xl p-2.5 bg-white outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="pg">Pilihan Ganda (PG)</option>
                    <option value="isian">Jawaban Singkat</option>
                    <option value="esai">Essay / Esai</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Bobot Nilai</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={soalForm.bobot_nilai}
                    onChange={(e) => setSoalForm({ ...soalForm, bobot_nilai: e.target.value })}
                    className="w-full text-xs border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              {/* Teks Pertanyaan */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Pertanyaan / Instruksi Soal *
                </label>
                <textarea
                  rows={4}
                  placeholder="Ketik teks pertanyaan soal di sini..."
                  value={soalForm.pertanyaan}
                  onChange={(e) => setSoalForm({ ...soalForm, pertanyaan: e.target.value })}
                  className="w-full text-xs border rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* FITUR GAMBAR SOAL (Untuk SEMUA JENIS SOAL) */}
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-primary" />
                    <span>Gambar Soal (Opsional - Semua Jenis Soal)</span>
                  </label>
                  {uploadingImage && (
                    <span className="text-[11px] text-primary flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" /> Mengunggah...
                    </span>
                  )}
                </div>

                {soalForm.gambar_url ? (
                  <div className="flex items-start gap-3 bg-white p-2 rounded-xl border border-gray-200">
                    <img
                      src={soalForm.gambar_url}
                      alt="Preview Gambar Soal"
                      className="h-24 w-32 object-contain rounded-lg border border-gray-100 bg-gray-50"
                    />
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-gray-500 font-medium break-all line-clamp-2">
                        {soalForm.gambar_url}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSoalForm(prev => ({ ...prev, gambar_url: '' }))}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                      >
                        <Trash2 size={12} /> Hapus Gambar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-primary bg-white hover:bg-blue-50 border border-blue-200 rounded-xl cursor-pointer transition shadow-xs">
                      <Upload size={13} />
                      <span>Unggah Gambar Soal</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'gambar_url')}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Format JPG, PNG, atau WebP (Maksimal 3MB).
                    </p>
                  </div>
                )}
              </div>

              {/* FITUR PILIHAN GANDA (Dengan Dukungan Gambar per Opsi) */}
              {soalForm.jenis_soal === 'pg' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800">
                      Opsi Pilihan Ganda & Centang Kunci Jawaban Benar:
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      Kunci Terpilih: {soalForm.kunci_jawaban}
                    </span>
                  </div>

                  {['A', 'B', 'C', 'D'].map((opsiKey) => {
                    const imgField = `opsi_${opsiKey.toLowerCase()}_gambar`;
                    const currentImg = soalForm[imgField];

                    return (
                      <div key={opsiKey} className="bg-white p-3 rounded-xl border border-gray-200 space-y-2">
                        <div className="flex items-center gap-2.5">
                          {/* Checklist / Radio Kunci Jawaban */}
                          <label className="flex items-center gap-1 cursor-pointer bg-slate-50 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-emerald-500">
                            <input
                              type="radio"
                              name="kunci_jawaban_pg"
                              value={opsiKey}
                              checked={soalForm.kunci_jawaban === opsiKey}
                              onChange={(e) => setSoalForm({ ...soalForm, kunci_jawaban: e.target.value })}
                              className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                            />
                            <span className="text-xs font-black text-gray-800">{opsiKey}</span>
                          </label>

                          {/* Input Text Pilihan */}
                          <input
                            type="text"
                            placeholder={`Teks pilihan jawaban ${opsiKey}`}
                            value={soalForm[`opsi_${opsiKey.toLowerCase()}`]}
                            onChange={(e) =>
                              setSoalForm({ ...soalForm, [`opsi_${opsiKey.toLowerCase()}`]: e.target.value })
                            }
                            className="flex-1 text-xs border rounded-xl p-2.5 bg-white outline-none focus:ring-2 focus:ring-primary"
                          />

                          {/* Tombol Unggah Gambar Opsi */}
                          <label
                            className={`p-2 rounded-xl border cursor-pointer transition flex items-center justify-center ${
                              currentImg
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600'
                            }`}
                            title={`Unggah Gambar Opsi ${opsiKey}`}
                          >
                            <ImageIcon size={15} />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, imgField)}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* Preview Gambar Opsi Jika Ada */}
                        {currentImg && (
                          <div className="flex items-center gap-2 pl-9">
                            <img
                              src={currentImg}
                              alt={`Preview Opsi ${opsiKey}`}
                              className="h-14 w-20 object-contain rounded-lg border border-gray-200 bg-gray-50 p-0.5"
                            />
                            <button
                              type="button"
                              onClick={() => setSoalForm(prev => ({ ...prev, [imgField]: '' }))}
                              className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
                            >
                              <X size={13} /> Hapus gambar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* FITUR JAWABAN SINGKAT */}
              {soalForm.jenis_soal === 'isian' && (
                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-2">
                  <label className="block text-xs font-bold text-amber-900">
                    Kunci Jawaban Singkat (1 Input Teks) *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Fotosintesis / H2O / Jakarta"
                    value={soalForm.kunci_jawaban}
                    onChange={(e) => setSoalForm({ ...soalForm, kunci_jawaban: e.target.value })}
                    className="w-full text-xs border border-amber-300 rounded-xl p-2.5 bg-white outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                    required
                  />
                  <p className="text-[11px] text-amber-700">
                    Sistem akan memvalidasi ketepatan kata kunci peserta dengan kunci jawaban ini (case-insensitive).
                  </p>
                </div>
              )}

              {/* FITUR ESSAY (AI RUBRIK) */}
              {soalForm.jenis_soal === 'esai' && (
                <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200 space-y-2">
                  <label className="block text-xs font-bold text-purple-900">
                    Rubrik Penilaian & Kunci Jawaban Semantik AI (Textarea) *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Sebutkan kata kunci, konsep materi utama, dan indikator penilaian esai untuk model AI..."
                    value={soalForm.rubrik_esai}
                    onChange={(e) => setSoalForm({ ...soalForm, rubrik_esai: e.target.value })}
                    className="w-full text-xs border border-purple-300 rounded-xl p-3 bg-white outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <p className="text-[11px] text-purple-700">
                    Model AI akan mencocokkan semantik jawaban esai siswa dengan rubrik ini secara komprehensif.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalSoalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="px-5 py-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {uploadingImage && <Loader2 size={13} className="animate-spin" />}
                  <span>Simpan Butir Soal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: BUAT / EDIT PAKET BANK SOAL
      ======================================================== */}
      {isModalBankOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
              <BookOpen size={18} />
              <span>{bankForm.id ? 'Edit Bank Soal' : 'Buat Paket Bank Soal Baru'}</span>
            </h3>

            <form onSubmit={handleSaveBank} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Kode Paket *</label>
                  <input
                    type="text"
                    value={bankForm.kode_bank}
                    onChange={(e) => setBankForm({ ...bankForm, kode_bank: e.target.value })}
                    className="w-full text-xs border rounded-xl p-2.5 uppercase font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tingkat Kelas</label>
                  <select
                    value={bankForm.tingkat_kelas}
                    onChange={(e) => setBankForm({ ...bankForm, tingkat_kelas: e.target.value })}
                    className="w-full text-xs border rounded-xl p-2.5 bg-white"
                  >
                    <option value="7">Kelas 7</option>
                    <option value="8">Kelas 8</option>
                    <option value="9">Kelas 9</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Judul Paket Ujian *</label>
                <input
                  type="text"
                  placeholder="Contoh: Paket Soal PSTS Bahasa Indonesia Kls 7"
                  value={bankForm.judul}
                  onChange={(e) => setBankForm({ ...bankForm, judul: e.target.value })}
                  className="w-full text-xs border rounded-xl p-2.5"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mata Pelajaran</label>
                <select
                  value={bankForm.mapel_id}
                  onChange={(e) => setBankForm({ ...bankForm, mapel_id: e.target.value })}
                  className="w-full text-xs border rounded-xl p-2.5 bg-white"
                >
                  <option value="">-- Pilih Mapel --</option>
                  {mapelList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama_mapel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Deskripsi / Petunjuk</label>
                <textarea
                  rows={2}
                  value={bankForm.deskripsi}
                  onChange={(e) => setBankForm({ ...bankForm, deskripsi: e.target.value })}
                  className="w-full text-xs border rounded-xl p-2.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalBankOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  Simpan Paket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
