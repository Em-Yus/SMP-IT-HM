import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../../services/supabaseClient';
import { DollarSign, ChevronLeft, Calendar, Printer, Search, Eye, FileText, X, CheckCircle, Clock, Award, ShieldCheck, User, Edit3, Save, Settings, Plus, Trash2, Sparkles } from 'lucide-react-native';
import { router } from 'expo-router';

export default function RekapHonorGuruScreen() {
  const [guruList, setGuruList] = useState<any[]>([]);
  const [jabatanGuruMap, setJabatanGuruMap] = useState<Record<number, any>>({});
  const [dataJabatanList, setDataJabatanList] = useState<any[]>([]);
  const [presensiGuruList, setPresensiGuruList] = useState<any[]>([]);
  const [presensiKbmList, setPresensiKbmList] = useState<any[]>([]);
  const [apresiasiKinerjaMap, setApresiasiKinerjaMap] = useState<Record<number, { id?: number; nominal: number; keterangan: string }>>({});
  const [dataLembaga, setDataLembaga] = useState<any>(null);

  const [canEditApresiasi, setCanEditApresiasi] = useState(false);
  const [canViewAll, setCanViewAll] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State Detail
  const [selectedGuruDetail, setSelectedGuruDetail] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Modal State Apresiasi Kinerja
  const [apresiasiModalOpen, setApresiasiModalOpen] = useState(false);
  const [apresiasiForm, setApresiasiForm] = useState<{ guru_id: number; guru_nama: string; nominal: string; keterangan: string }>({
    guru_id: 0,
    guru_nama: '',
    nominal: '',
    keterangan: ''
  });
  const [isSavingApresiasi, setIsSavingApresiasi] = useState(false);
  const [masterJenisApresiasi, setMasterJenisApresiasi] = useState<any[]>([]);
  const [crudMasterModalOpen, setCrudMasterModalOpen] = useState(false);
  const [editingJenis, setEditingJenis] = useState<any>(null);
  const [jenisForm, setJenisForm] = useState<{ nama_apresiasi: string; nominal_default: string }>({
    nama_apresiasi: '',
    nominal_default: ''
  });
  const [isSavingJenis, setIsSavingJenis] = useState(false);

  const bulanNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  useEffect(() => {
    fetchData();
  }, [selectedBulan, selectedTahun]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 0. Cek hak akses:
      // Hanya Operator, Bendahara, dan Kepala Sekolah (serta Admin) yang dapat melihat SEMUA nama.
      // Guru lainnya hanya melihat data dirinya sendiri berdasarkan akun login.
      const userStr = await AsyncStorage.getItem('user_guru');
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          setCurrentUser(userObj);
          let authorizedToViewAll = userObj?.role === 'admin';

          if (userObj?.id) {
            const { data: jData } = await supabase.from('jabatan_guru').select('*').eq('guru_id', userObj.id).maybeSingle();
            if (jData) {
              const roles = [jData.jabatan_utama, jData.jabatan_lain_1, jData.jabatan_lain_2, jData.jabatan_lain_3].filter(Boolean);
              authorizedToViewAll = roles.some((r: string) => {
                const lower = (r || '').toLowerCase();
                return lower.includes('operator') || lower.includes('bendahara') || lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('admin');
              });
            }
          }
          setCanViewAll(authorizedToViewAll);
          setCanEditApresiasi(authorizedToViewAll);
        } catch (e) {
          console.error('Error parse user_guru:', e);
        }
      }

      const { data: lembaga } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (lembaga) setDataLembaga(lembaga);

      const { data: guru, error: errGuru } = await supabase
        .from('data_guru')
        .select('*')
        .is('tanggal_keluar', null)
        .order('nama', { ascending: true });
      if (errGuru) throw errGuru;
      setGuruList(guru || []);

      const { data: jabatan } = await supabase.from('data_jabatan').select('*');
      setDataJabatanList(jabatan || []);

      const { data: jGuru } = await supabase.from('jabatan_guru').select('*');
      const jMap: Record<number, any> = {};
      (jGuru || []).forEach((jg) => {
        jMap[jg.guru_id] = jg;
      });
      setJabatanGuruMap(jMap);

      const startMonthStr = `${selectedTahun}-${String(selectedBulan).padStart(2, '0')}-01`;
      const endMonthStr = `${selectedTahun}-${String(selectedBulan).padStart(2, '0')}-31`;

      const { data: presensi } = await supabase
        .from('presensi_guru')
        .select('*')
        .gte('tanggal', startMonthStr)
        .lte('tanggal', endMonthStr);
      setPresensiGuruList(presensi || []);

      const { data: kbm } = await supabase
        .from('presensi_kbm_guru')
        .select('*')
        .gte('tanggal', startMonthStr)
        .lte('tanggal', endMonthStr);
      setPresensiKbmList(kbm || []);

      // Fetch Apresiasi Kinerja Guru
      const { data: apresiasiList, error: errApresiasi } = await supabase
        .from('apresiasi_kinerja_guru')
        .select('*')
        .eq('bulan', selectedBulan)
        .eq('tahun', selectedTahun);
      if (errApresiasi && errApresiasi.code !== '42P01') {
        console.error('Fetch apresiasi error:', errApresiasi);
      }

      const apMap: Record<number, { id?: number; nominal: number; keterangan: string }> = {};
      (apresiasiList || []).forEach((item: any) => {
        apMap[item.guru_id] = {
          id: item.id,
          nominal: Number(item.nominal) || 0,
          keterangan: item.keterangan || ''
        };
      });
      setApresiasiKinerjaMap(apMap);
      await fetchMasterJenis();

    } catch (err: any) {
      console.error('Fetch error:', err);
      Alert.alert('Error', 'Gagal mengambil data rekap honor.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTeacherHonor = (guruId: number) => {
    const jg = jabatanGuruMap[guruId];

    // Standar honor Guru Ngaji di data_jabatan
    const djNgaji = dataJabatanList.find((dj) => dj.nama_jabatan?.toLowerCase().includes('ngaji'));
    const defaultHonorNgaji = djNgaji && djNgaji.honor ? Number(djNgaji.honor) : 200000;

    let tunjanganJabatan = 0;
    let honorGuruNgaji = 0;
    let isGuruNgaji = false;
    let namaJabatanUtama = '-';

    if (jg) {
      namaJabatanUtama = jg.jabatan_utama || '-';
      const rawRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3].filter(Boolean);
      const allRoles = [...new Set(rawRoles.map((r) => (r ? String(r).trim() : '')).filter(Boolean))];

      allRoles.forEach((roleName) => {
        const lower = roleName.toLowerCase();
        const found = dataJabatanList.find((dj) => dj.nama_jabatan?.toLowerCase() === lower);
        const honorVal = found && found.honor ? Number(found.honor) : 0;

        if (lower.includes('ngaji')) {
          isGuruNgaji = true;
          honorGuruNgaji = honorVal > 0 ? honorVal : defaultHonorNgaji;
        } else {
          tunjanganJabatan += honorVal;
        }
      });
    }

    const myPresensi = presensiGuruList.filter((p) => String(p.guru_id) === String(guruId));
    const totalHariHadir = myPresensi.filter((p) => p.status === 'Hadir').length;
    const totalHonorKehadiran = myPresensi.reduce((sum, p) => sum + (Number(p.honor_kehadiran) || 0), 0);

    const myKbm = presensiKbmList.filter((k) => String(k.guru_id) === String(guruId));
    const totalJp = myKbm.reduce((sum, k) => sum + (Number(k.jumlah_jp) || 1), 0);
    // Arahan Kepala Sekolah: KBM mengacu pada jadwal, walaupun telat atau keluar lebih dulu tidak ada pemotongan honor sama sekali (Rp 6.500/JP penuh)
    const totalHonorKbm = totalJp * 6500;
    const totalJpInval = myKbm.filter((k) => k.is_pengganti).reduce((sum, k) => sum + (Number(k.jumlah_jp) || 1), 0);

    const apItem = apresiasiKinerjaMap[guruId] || { nominal: 0, keterangan: '' };
    const apresiasiKinerja = Number(apItem.nominal) || 0;
    const keteranganApresiasi = apItem.keterangan || '';

    // Total Bersih: Kehadiran + KBM + Tunjangan Jabatan Lain + Honor Guru Ngaji (tanpa potongan walaupun tidak hadir) + Apresiasi Kinerja
    const totalHonorBersih = totalHonorKehadiran + totalHonorKbm + tunjanganJabatan + honorGuruNgaji + apresiasiKinerja;

    return {
      namaJabatanUtama,
      isGuruNgaji,
      honorGuruNgaji,
      totalHariHadir,
      totalHonorKehadiran,
      totalJp,
      totalJpInval,
      totalHonorKbm,
      tunjanganJabatan,
      apresiasiKinerja,
      keteranganApresiasi,
      totalHonorBersih,
      myPresensi,
      myKbm
    };
  };

  // Batasi hanya akun yang login jika bukan Operator, Bendahara, atau Kepala Sekolah
  const availableGuru = canViewAll
    ? guruList
    : currentUser
      ? guruList.filter((g) => String(g.id) === String(currentUser.id))
      : [];

  const filteredGuru = availableGuru.filter((g) =>
    g.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.nip?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalHonorSeluruh = filteredGuru.reduce((sum, g) => {
    const calc = calculateTeacherHonor(g.id);
    return sum + calc.totalHonorBersih;
  }, 0);

  const openDetail = (guru: any) => {
    const calc = calculateTeacherHonor(guru.id);
    setSelectedGuruDetail({ ...guru, ...calc });
    setDetailModalOpen(true);
  };

  const fetchMasterJenis = async () => {
    try {
      const { data, error } = await supabase
        .from('master_jenis_apresiasi')
        .select('*')
        .order('id', { ascending: true });
      if (!error && data) {
        setMasterJenisApresiasi(data);
      }
    } catch (e) {
      console.error('Fetch master jenis error:', e);
    }
  };

  const openEditApresiasi = (guru: any) => {
    const apItem = apresiasiKinerjaMap[guru.id] || { nominal: 0, keterangan: '' };
    let initKet = apItem.keterangan || '';
    let initNom = apItem.nominal ? String(apItem.nominal) : '';

    if (!initKet && masterJenisApresiasi.length > 0) {
      initKet = masterJenisApresiasi[0].nama_apresiasi;
      if (!initNom && Number(masterJenisApresiasi[0].nominal_default) > 0) {
        initNom = String(masterJenisApresiasi[0].nominal_default);
      }
    }

    setApresiasiForm({
      guru_id: guru.id,
      guru_nama: guru.nama,
      nominal: initNom,
      keterangan: initKet
    });
    setApresiasiModalOpen(true);
  };

  const handleJenisSelect = (selectedNama: string) => {
    const matched = masterJenisApresiasi.find((m) => m.nama_apresiasi === selectedNama);
    let newNominal = apresiasiForm.nominal;
    if (matched && Number(matched.nominal_default) > 0) {
      if (!newNominal || Number(newNominal) === 0) {
        newNominal = String(matched.nominal_default);
      }
    }
    setApresiasiForm((prev) => ({
      ...prev,
      keterangan: selectedNama,
      nominal: newNominal
    }));
  };

  const handleSaveJenis = async () => {
    if (!jenisForm.nama_apresiasi.trim()) {
      Alert.alert('Perhatian', 'Nama jenis apresiasi tidak boleh kosong.');
      return;
    }
    setIsSavingJenis(true);
    try {
      const numNominal = Number(jenisForm.nominal_default.toString().replace(/[^0-9]/g, '')) || 0;
      if (editingJenis) {
        const { error } = await supabase
          .from('master_jenis_apresiasi')
          .update({
            nama_apresiasi: jenisForm.nama_apresiasi.trim(),
            nominal_default: numNominal
          })
          .eq('id', editingJenis.id);
        if (error) throw error;
        Alert.alert('Berhasil', 'Jenis apresiasi berhasil diperbarui.');
      } else {
        const { error } = await supabase
          .from('master_jenis_apresiasi')
          .insert({
            nama_apresiasi: jenisForm.nama_apresiasi.trim(),
            nominal_default: numNominal
          });
        if (error) throw error;
        Alert.alert('Berhasil', 'Jenis apresiasi baru berhasil ditambahkan.');
      }
      setEditingJenis(null);
      setJenisForm({ nama_apresiasi: '', nominal_default: '' });
      await fetchMasterJenis();
    } catch (err: any) {
      console.error('Save jenis error:', err);
      Alert.alert('Gagal', err.message || 'Gagal menyimpan jenis apresiasi.');
    } finally {
      setIsSavingJenis(false);
    }
  };

  const handleDeleteJenis = (id: number, nama: string) => {
    Alert.alert(
      'Hapus Pilihan?',
      `Yakin ingin menghapus opsi "${nama}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('master_jenis_apresiasi').delete().eq('id', id);
              if (error) throw error;
              await fetchMasterJenis();
            } catch (err: any) {
              Alert.alert('Gagal', err.message || 'Gagal menghapus jenis apresiasi.');
            }
          }
        }
      ]
    );
  };

  const handleSaveApresiasi = async () => {
    if (!apresiasiForm.guru_id) return;
    setIsSavingApresiasi(true);
    try {
      const numNominal = Number(apresiasiForm.nominal.toString().replace(/[^0-9]/g, '')) || 0;
      const { error } = await supabase
        .from('apresiasi_kinerja_guru')
        .upsert({
          guru_id: apresiasiForm.guru_id,
          bulan: selectedBulan,
          tahun: selectedTahun,
          nominal: numNominal,
          keterangan: apresiasiForm.keterangan,
          updated_at: new Date().toISOString()
        }, { onConflict: 'guru_id,bulan,tahun' });

      if (error) throw error;

      setApresiasiKinerjaMap((prev) => ({
        ...prev,
        [apresiasiForm.guru_id]: {
          nominal: numNominal,
          keterangan: apresiasiForm.keterangan
        }
      }));

      setApresiasiModalOpen(false);
      Alert.alert('Berhasil', `Apresiasi kinerja untuk ${apresiasiForm.guru_nama} berhasil disimpan.`);
    } catch (err: any) {
      console.error('Save apresiasi error:', err);
      Alert.alert('Gagal', 'Gagal menyimpan apresiasi kinerja.');
    } finally {
      setIsSavingApresiasi(false);
    }
  };

  const printSingleSlip = async (guru: any) => {
    let Print: any;
    try {
      Print = require('expo-print');
    } catch (e) {
      Alert.alert('Perhatian', 'Fitur cetak membutuhkan build aplikasi terbaru.');
      return;
    }

    const calc = calculateTeacherHonor(guru.id);
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            @page { size: A5 portrait; margin: 10mm; }
            body { font-family: sans-serif; padding: 10px; color: #111827; }
            .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 15px; }
            .title { font-size: 14px; font-weight: 900; text-transform: uppercase; }
            .sub { font-size: 10px; color: #6b7280; }
            .badge { display: inline-block; background: #111827; color: white; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: bold; margin-top: 6px; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; background: #f9fafb; padding: 8px; border-radius: 8px; }
            .info-table td { padding: 4px 6px; }
            .rincian-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; border-top: 1px dashed #9ca3af; border-bottom: 1px dashed #9ca3af; }
            .rincian-table td { padding: 8px 4px; }
            .total-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: bold; color: #065f46; display: flex; justify-content: space-between; }
            .signature { margin-top: 30px; width: 100%; font-size: 10px; text-align: center; }
          </style>
        </head>
        <body>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 12px;">
            <tr>
              <td width="55" align="center" valign="middle">
                ${dataLembaga?.logo_url ? `<img src="${dataLembaga.logo_url}" style="width: 50px; height: 50px; object-fit: contain;" />` : ''}
              </td>
              <td align="center" valign="middle" style="padding: 0 8px;">
                <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #374151;">${(dataLembaga?.nama_yayasan || 'YAYASAN HIDAYATUL MUBTADI-IEN').toUpperCase()}</div>
                <div style="font-size: 14px; font-weight: 900; text-transform: uppercase; color: #111827; margin: 2px 0;">${(dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN').toUpperCase()}</div>
                <div style="font-size: 9px; color: #6b7280;">${dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang'}</div>
              </td>
              <td width="55" align="center" valign="middle">
                ${dataLembaga?.logo_url ? `<div style="width: 50px;"></div>` : ''}
              </td>
            </tr>
          </table>
          <div style="text-align: center; margin-bottom: 12px;">
            <div class="badge">SLIP HONORARIUM GURU</div>
          </div>

          <table class="info-table">
            <tr>
              <td width="30%"><strong>Nama Guru:</strong></td>
              <td>${guru.nama}</td>
              <td width="20%"><strong>Periode:</strong></td>
              <td>${bulanNames[selectedBulan - 1]} ${selectedTahun}</td>
            </tr>
            <tr>
              <td><strong>Jabatan:</strong></td>
              <td>${calc.namaJabatanUtama} ${calc.isGuruNgaji ? '(Guru Ngaji)' : ''}</td>
              <td><strong>NIP / NIK:</strong></td>
              <td>${guru.nip || guru.nik || '-'}</td>
            </tr>
          </table>

          <table class="rincian-table">
            <tr>
              <td>1. Honor Kehadiran (${calc.totalHariHadir} hari)</td>
              <td align="right"><strong>Rp ${calc.totalHonorKehadiran.toLocaleString('id-ID')}</strong></td>
            </tr>
            <tr>
              <td>2. Honor Mengajar KBM (${calc.totalJp} JP ${calc.totalJpInval > 0 ? `[Inval: ${calc.totalJpInval} JP]` : ''})</td>
              <td align="right"><strong>Rp ${calc.totalHonorKbm.toLocaleString('id-ID')}</strong></td>
            </tr>
            <tr>
              <td>3. Tunjangan Jabatan</td>
              <td align="right"><strong>Rp ${calc.tunjanganJabatan.toLocaleString('id-ID')}</strong></td>
            </tr>
            ${calc.isGuruNgaji ? `
            <tr>
              <td>4. Honor Guru Ngaji <span style="font-size: 9px; color: #059669;">(Tetap, tanpa potongan)</span></td>
              <td align="right"><strong>Rp ${calc.honorGuruNgaji.toLocaleString('id-ID')}</strong></td>
            </tr>
            ` : ''}
            ${calc.apresiasiKinerja > 0 ? `
            <tr>
              <td>${calc.isGuruNgaji ? '5' : '4'}. Apresiasi Kinerja ${calc.keteranganApresiasi ? `<em>(${calc.keteranganApresiasi})</em>` : ''}</td>
              <td align="right"><strong>Rp ${calc.apresiasiKinerja.toLocaleString('id-ID')}</strong></td>
            </tr>
            ` : ''}
          </table>

          <div class="total-box">
            <span>TOTAL HONOR DITERIMA:</span>
            <span>Rp ${calc.totalHonorBersih.toLocaleString('id-ID')}</span>
          </div>

          <table class="signature">
            <tr>
              <td width="50%">
                Penerima,<br/><br/><br/><br/>
                <u><b>${guru.nama}</b></u>
              </td>
              <td width="50%">
                Subang, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
                Bendahara Sekolah,<br/><br/><br/><br/>
                <u><b>____________________</b></u>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    try {
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat mencetak slip.');
    }
  };

  const printAllSlips = async () => {
    let Print: any;
    try {
      Print = require('expo-print');
    } catch (e) {
      Alert.alert('Perhatian', 'Fitur cetak membutuhkan build aplikasi terbaru.');
      return;
    }

    if (filteredGuru.length === 0) {
      Alert.alert('Info', 'Tidak ada data guru untuk dicetak.');
      return;
    }

    const slipsHtml = filteredGuru.map((guru) => {
      const calc = calculateTeacherHonor(guru.id);
      return `
        <div class="slip-card">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 12px;">
            <tr>
              <td width="55" align="center" valign="middle">
                ${dataLembaga?.logo_url ? `<img src="${dataLembaga.logo_url}" style="width: 50px; height: 50px; object-fit: contain;" />` : ''}
              </td>
              <td align="center" valign="middle" style="padding: 0 8px;">
                <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #374151;">${(dataLembaga?.nama_yayasan || 'YAYASAN HIDAYATUL MUBTADI-IEN').toUpperCase()}</div>
                <div style="font-size: 14px; font-weight: 900; text-transform: uppercase; color: #111827; margin: 2px 0;">${(dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN').toUpperCase()}</div>
                <div style="font-size: 9px; color: #6b7280;">${dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang'}</div>
              </td>
              <td width="55" align="center" valign="middle">
                ${dataLembaga?.logo_url ? `<div style="width: 50px;"></div>` : ''}
              </td>
            </tr>
          </table>
          <div style="text-align: center; margin-bottom: 12px;">
            <div class="badge">SLIP HONORARIUM GURU</div>
          </div>

          <table class="info-table">
            <tr>
              <td width="30%"><strong>Nama Guru:</strong></td>
              <td>${guru.nama}</td>
              <td width="20%"><strong>Periode:</strong></td>
              <td>${bulanNames[selectedBulan - 1]} ${selectedTahun}</td>
            </tr>
            <tr>
              <td><strong>Jabatan:</strong></td>
              <td>${calc.namaJabatanUtama} ${calc.isGuruNgaji ? '(Guru Ngaji)' : ''}</td>
              <td><strong>NIP / NIK:</strong></td>
              <td>${guru.nip || guru.nik || '-'}</td>
            </tr>
          </table>

          <table class="rincian-table">
            <tr>
              <td>1. Honor Kehadiran (${calc.totalHariHadir} hari)</td>
              <td align="right"><strong>Rp ${calc.totalHonorKehadiran.toLocaleString('id-ID')}</strong></td>
            </tr>
            <tr>
              <td>2. Honor Mengajar KBM (${calc.totalJp} JP ${calc.totalJpInval > 0 ? `[Inval: ${calc.totalJpInval} JP]` : ''})</td>
              <td align="right"><strong>Rp ${calc.totalHonorKbm.toLocaleString('id-ID')}</strong></td>
            </tr>
            <tr>
              <td>3. Tunjangan Jabatan</td>
              <td align="right"><strong>Rp ${calc.tunjanganJabatan.toLocaleString('id-ID')}</strong></td>
            </tr>
            ${calc.isGuruNgaji ? `
            <tr>
              <td>4. Honor Guru Ngaji <span style="font-size: 9px; color: #059669;">(Tetap, tanpa potongan)</span></td>
              <td align="right"><strong>Rp ${calc.honorGuruNgaji.toLocaleString('id-ID')}</strong></td>
            </tr>
            ` : ''}
            ${calc.apresiasiKinerja > 0 ? `
            <tr>
              <td>${calc.isGuruNgaji ? '5' : '4'}. Apresiasi Kinerja ${calc.keteranganApresiasi ? `<em>(${calc.keteranganApresiasi})</em>` : ''}</td>
              <td align="right"><strong>Rp ${calc.apresiasiKinerja.toLocaleString('id-ID')}</strong></td>
            </tr>
            ` : ''}
          </table>

          <div class="total-box">
            <span>TOTAL HONOR DITERIMA:</span>
            <span>Rp ${calc.totalHonorBersih.toLocaleString('id-ID')}</span>
          </div>

          <table class="signature">
            <tr>
              <td width="50%">
                Penerima,<br/><br/><br/><br/>
                <u><b>${guru.nama}</b></u>
              </td>
              <td width="50%">
                Subang, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
                Bendahara Sekolah,<br/><br/><br/><br/>
                <u><b>____________________</b></u>
              </td>
            </tr>
          </table>
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            @page { size: A5 portrait; margin: 10mm; }
            body { font-family: sans-serif; padding: 0; margin: 0; color: #111827; }
            .slip-card { padding: 10px; page-break-after: always; break-after: page; min-height: 90vh; }
            .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 15px; }
            .title { font-size: 14px; font-weight: 900; text-transform: uppercase; }
            .sub { font-size: 10px; color: #6b7280; }
            .badge { display: inline-block; background: #111827; color: white; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: bold; margin-top: 6px; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; background: #f9fafb; padding: 8px; border-radius: 8px; }
            .info-table td { padding: 4px 6px; }
            .rincian-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; border-top: 1px dashed #9ca3af; border-bottom: 1px dashed #9ca3af; }
            .rincian-table td { padding: 8px 4px; }
            .total-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: bold; color: #065f46; display: flex; justify-content: space-between; }
            .signature { margin-top: 30px; width: 100%; font-size: 10px; text-align: center; }
          </style>
        </head>
        <body>
          ${slipsHtml}
        </body>
      </html>
    `;

    try {
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat mencetak semua slip.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rekap Honorarium Guru</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Month & Year Filter Dropdown */}
      <View style={styles.filterCard}>
        <View style={styles.filterHeaderRow}>
          <Calendar size={16} color="#1E257F" />
          <Text style={styles.filterTitle}>Periode Honor Guru:</Text>
        </View>
        <View style={styles.filterDropdownRow}>
          <View style={[styles.pickerWrapper, { flex: 3 }]}>
            <Picker
              selectedValue={selectedBulan}
              onValueChange={(val) => setSelectedBulan(Number(val))}
              style={styles.picker}
              dropdownIconColor="#1E257F"
            >
              {bulanNames.map((b, idx) => (
                <Picker.Item key={idx} label={`Bulan ${b}`} value={idx + 1} />
              ))}
            </Picker>
          </View>
          <View style={[styles.pickerWrapper, { flex: 2 }]}>
            <Picker
              selectedValue={selectedTahun}
              onValueChange={(val) => setSelectedTahun(Number(val))}
              style={styles.picker}
              dropdownIconColor="#1E257F"
            >
              {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                <Picker.Item key={yr} label={String(yr)} value={yr} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Total Budget Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            {canViewAll ? `Total Anggaran Honor (${bulanNames[selectedBulan - 1]} ${selectedTahun})` : `Total Honor Anda (${bulanNames[selectedBulan - 1]} ${selectedTahun})`}
          </Text>
          <Text style={styles.summaryValue}>Rp {totalHonorSeluruh.toLocaleString('id-ID')}</Text>
          <View style={styles.summaryMetaRow}>
            <Text style={styles.summaryMetaText}>• Hadir: Rp 5rb</Text>
            <Text style={styles.summaryMetaText}>• KBM: Rp 6.500/JP (Penuh)</Text>
            <Text style={styles.summaryMetaText}>• Ngaji: Rp 200rb (Tetap)</Text>
          </View>

          {canViewAll && (
            <TouchableOpacity style={styles.btnCetakSemua} onPress={printAllSlips}>
              <Printer size={15} color="#065F46" />
              <Text style={styles.btnCetakSemuaText}>Cetak Semua Slip Gaji ({filteredGuru.length} Guru)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Box (Khusus Operator / Bendahara / Kepala Sekolah) */}
        {canViewAll && (
          <View style={styles.searchBox}>
            <Search size={18} color="#9ca3af" />
            <TextInput
              placeholder="Cari nama guru atau NIP..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#1E257F" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.guruList}>
            {filteredGuru.map((guru) => {
              const calc = calculateTeacherHonor(guru.id);
              return (
                <View key={guru.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guruName}>{guru.nama}</Text>
                      <Text style={styles.guruNip}>
                        {calc.namaJabatanUtama} {calc.isGuruNgaji ? '• Guru Ngaji' : ''} {guru.nip ? `• NIP: ${guru.nip}` : ''}
                      </Text>
                    </View>
                    <View style={styles.totalBadge}>
                      <Text style={styles.totalBadgeText}>Rp {calc.totalHonorBersih.toLocaleString('id-ID')}</Text>
                    </View>
                  </View>

                  <View style={styles.breakdownGrid}>
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>Kehadiran</Text>
                      <Text style={styles.breakdownVal}>{calc.totalHariHadir} Hari</Text>
                      <Text style={styles.breakdownSub}>Rp {calc.totalHonorKehadiran.toLocaleString('id-ID')}</Text>
                    </View>
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>KBM</Text>
                      <Text style={styles.breakdownVal}>{calc.totalJp} JP</Text>
                      <Text style={styles.breakdownSub}>Rp {calc.totalHonorKbm.toLocaleString('id-ID')}</Text>
                    </View>
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>Tunjangan</Text>
                      <Text style={styles.breakdownVal}>-</Text>
                      <Text style={styles.breakdownSub}>Rp {calc.tunjanganJabatan.toLocaleString('id-ID')}</Text>
                    </View>
                    {calc.isGuruNgaji && (
                      <View style={styles.breakdownItem}>
                        <Text style={styles.breakdownLabel}>Guru Ngaji</Text>
                        <Text style={styles.breakdownVal}>Tetap</Text>
                        <Text style={[styles.breakdownSub, { color: '#0d9488' }]}>Rp {calc.honorGuruNgaji.toLocaleString('id-ID')}</Text>
                      </View>
                    )}
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>Apresiasi</Text>
                      <Text style={styles.breakdownVal}>{calc.apresiasiKinerja > 0 ? 'Ada' : '-'}</Text>
                      <Text style={[styles.breakdownSub, { color: '#7c3aed' }]}>Rp {calc.apresiasiKinerja.toLocaleString('id-ID')}</Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    {canEditApresiasi && (
                      <TouchableOpacity style={styles.btnApresiasi} onPress={() => openEditApresiasi(guru)}>
                        <Edit3 size={13} color="#7c3aed" />
                        <Text style={styles.btnApresiasiText}>Apresiasi</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.btnDetail} onPress={() => openDetail(guru)}>
                      <Eye size={13} color="#1E257F" />
                      <Text style={styles.btnDetailText}>Rincian</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSlip} onPress={() => printSingleSlip(guru)}>
                      <Printer size={13} color="#059669" />
                      <Text style={styles.btnSlipText}>Slip Gaji</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal Edit Apresiasi Kinerja (Khusus Kepala Sekolah & Bendahara) */}
      <Modal
        visible={apresiasiModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setApresiasiModalOpen(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Apresiasi Kinerja Guru</Text>
                <Text style={styles.modalSub}>{apresiasiForm.guru_nama}</Text>
              </View>
              <TouchableOpacity onPress={() => setApresiasiModalOpen(false)}>
                <X color="#6C757D" size={22} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.inputLabel}>Jenis Apresiasi *</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  onPress={() => setCrudMasterModalOpen(true)}
                >
                  <Settings size={13} color="#7c3aed" />
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#7c3aed' }}>Kelola Pilihan</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={apresiasiForm.keterangan}
                  onValueChange={(itemValue) => handleJenisSelect(itemValue)}
                  style={styles.picker}
                  dropdownIconColor="#7c3aed"
                >
                  <Picker.Item label="-- Pilih Jenis Apresiasi --" value="" color="#9CA3AF" />
                  {masterJenisApresiasi.map((item) => (
                    <Picker.Item
                      key={item.id}
                      label={`${item.nama_apresiasi}${Number(item.nominal_default) > 0 ? ` (Rp ${Number(item.nominal_default).toLocaleString('id-ID')})` : ''}`}
                      value={item.nama_apresiasi}
                    />
                  ))}
                  {apresiasiForm.keterangan && !masterJenisApresiasi.some((m) => m.nama_apresiasi === apresiasiForm.keterangan) && (
                    <Picker.Item label={`${apresiasiForm.keterangan} (Kustom)`} value={apresiasiForm.keterangan} />
                  )}
                </Picker>
              </View>
              <Text style={styles.inputHint}>Pilih opsi dari master agar rapi tanpa mengetik manual.</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nominal Apresiasi (Rp) *</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="Contoh: 150000"
                value={apresiasiForm.nominal}
                onChangeText={(val) => setApresiasiForm({ ...apresiasiForm, nominal: val })}
              />
              <Text style={styles.inputHint}>Otomatis terisi standar, dapat disesuaikan Kepala Sekolah / Bendahara.</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setApresiasiModalOpen(false)}
                disabled={isSavingApresiasi}
              >
                <Text style={styles.btnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSave}
                onPress={handleSaveApresiasi}
                disabled={isSavingApresiasi}
              >
                {isSavingApresiasi ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Save size={14} color="#fff" />
                    <Text style={styles.btnSaveText}>Simpan</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal CRUD Master Jenis Apresiasi */}
      <Modal
        visible={crudMasterModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setCrudMasterModalOpen(false);
          setEditingJenis(null);
          setJenisForm({ nama_apresiasi: '', nominal_default: '' });
        }}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalCardCenter, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} color="#7c3aed" />
                  <Text style={styles.modalTitle}>Master Jenis Apresiasi</Text>
                </View>
                <Text style={styles.modalSub}>Kelola opsi standar & nominal default</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setCrudMasterModalOpen(false);
                  setEditingJenis(null);
                  setJenisForm({ nama_apresiasi: '', nominal_default: '' });
                }}
              >
                <X color="#6C757D" size={22} />
              </TouchableOpacity>
            </View>

            {/* Form Tambah / Edit */}
            <View style={styles.crudFormBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#065F46', textTransform: 'uppercase' }}>
                  {editingJenis ? 'Edit Jenis Apresiasi' : 'Tambah Opsi Baru'}
                </Text>
                {editingJenis && (
                  <TouchableOpacity
                    onPress={() => {
                      setEditingJenis(null);
                      setJenisForm({ nama_apresiasi: '', nominal_default: '' });
                    }}
                  >
                    <Text style={{ fontSize: 11, color: '#6B7280', textDecorationLine: 'underline' }}>Batal Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[styles.textInput, { marginBottom: 8, backgroundColor: '#fff' }]}
                placeholder="Nama Opsi (Cth: Pembimbing Olimpiade)"
                value={jenisForm.nama_apresiasi}
                onChangeText={(t) => setJenisForm({ ...jenisForm, nama_apresiasi: t })}
              />
              <TextInput
                style={[styles.textInput, { marginBottom: 8, backgroundColor: '#fff' }]}
                placeholder="Nominal Standar (Rp, Cth: 150000)"
                keyboardType="numeric"
                value={jenisForm.nominal_default}
                onChangeText={(t) => setJenisForm({ ...jenisForm, nominal_default: t })}
              />
              <TouchableOpacity
                style={[styles.btnSave, { alignSelf: 'flex-end', backgroundColor: '#059669' }]}
                onPress={handleSaveJenis}
                disabled={isSavingJenis}
              >
                {isSavingJenis ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    {editingJenis ? <Save size={13} color="#fff" /> : <Plus size={13} color="#fff" />}
                    <Text style={styles.btnSaveText}>{editingJenis ? 'Perbarui Opsi' : 'Simpan Opsi'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Daftar Opsi */}
            <Text style={[styles.inputLabel, { marginTop: 6, marginBottom: 8 }]}>
              Daftar Opsi Tersedia ({masterJenisApresiasi.length})
            </Text>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {masterJenisApresiasi.length === 0 ? (
                <Text style={styles.emptyText}>Belum ada master opsi apresiasi.</Text>
              ) : (
                masterJenisApresiasi.map((item) => (
                  <View key={item.id} style={styles.crudItemRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.crudItemTitle}>{item.nama_apresiasi}</Text>
                      <Text style={styles.crudItemSub}>
                        Standar: Rp {(Number(item.nominal_default) || 0).toLocaleString('id-ID')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={{ padding: 6, backgroundColor: '#EEF2FF', borderRadius: 8 }}
                        onPress={() => {
                          setEditingJenis(item);
                          setJenisForm({
                            nama_apresiasi: item.nama_apresiasi,
                            nominal_default: item.nominal_default ? String(item.nominal_default) : ''
                          });
                        }}
                      >
                        <Edit3 size={15} color="#4338CA" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ padding: 6, backgroundColor: '#FEE2E2', borderRadius: 8 }}
                        onPress={() => handleDeleteJenis(item.id, item.nama_apresiasi)}
                      >
                        <Trash2 size={15} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', alignItems: 'flex-end' }}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => {
                  setCrudMasterModalOpen(false);
                  setEditingJenis(null);
                  setJenisForm({ nama_apresiasi: '', nominal_default: '' });
                }}
              >
                <Text style={styles.btnCancelText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Rincian */}
      <Modal
        visible={detailModalOpen && !!selectedGuruDetail}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDetailModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Rincian Log Presensi</Text>
                <Text style={styles.modalSub}>{selectedGuruDetail?.nama}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModalOpen(false)}>
                <X color="#6C757D" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Summary */}
              <View style={styles.modalSummary}>
                <View style={styles.modalSumRow}>
                  <Text style={styles.modalSumLabel}>Honor Kehadiran:</Text>
                  <Text style={styles.modalSumVal}>Rp {selectedGuruDetail?.totalHonorKehadiran?.toLocaleString('id-ID')}</Text>
                </View>
                <View style={styles.modalSumRow}>
                  <Text style={styles.modalSumLabel}>Honor KBM Mengajar:</Text>
                  <Text style={styles.modalSumVal}>Rp {selectedGuruDetail?.totalHonorKbm?.toLocaleString('id-ID')}</Text>
                </View>
                <View style={styles.modalSumRow}>
                  <Text style={styles.modalSumLabel}>Tunjangan Jabatan:</Text>
                  <Text style={styles.modalSumVal}>Rp {selectedGuruDetail?.tunjanganJabatan?.toLocaleString('id-ID')}</Text>
                </View>
                {selectedGuruDetail?.isGuruNgaji && (
                  <View style={styles.modalSumRow}>
                    <Text style={[styles.modalSumLabel, { color: '#0d9488' }]}>Honor Guru Ngaji (Tetap):</Text>
                    <Text style={[styles.modalSumVal, { color: '#0d9488' }]}>Rp {selectedGuruDetail?.honorGuruNgaji?.toLocaleString('id-ID')}</Text>
                  </View>
                )}
                {selectedGuruDetail?.apresiasiKinerja > 0 && (
                  <View style={styles.modalSumRow}>
                    <Text style={[styles.modalSumLabel, { color: '#7c3aed' }]}>Apresiasi Kinerja:</Text>
                    <Text style={[styles.modalSumVal, { color: '#7c3aed' }]}>Rp {selectedGuruDetail?.apresiasiKinerja?.toLocaleString('id-ID')}</Text>
                  </View>
                )}
                {selectedGuruDetail?.keteranganApresiasi ? (
                  <Text style={styles.modalSumKet}>Catatan: "{selectedGuruDetail?.keteranganApresiasi}"</Text>
                ) : null}
                <View style={[styles.modalSumRow, { borderTopWidth: 1, borderTopColor: '#A7F3D0', paddingTop: 6, marginTop: 4 }]}>
                  <Text style={[styles.modalSumLabel, { fontWeight: 'bold', color: '#065F46' }]}>Total Bersih:</Text>
                  <Text style={[styles.modalSumVal, { fontWeight: '900', color: '#065F46', fontSize: 14 }]}>
                    Rp {selectedGuruDetail?.totalHonorBersih?.toLocaleString('id-ID')}
                  </Text>
                </View>
              </View>

              {/* Log Kehadiran */}
              <Text style={styles.logSectionTitle}>Log Kehadiran ({selectedGuruDetail?.totalHariHadir} Hari Hadir)</Text>
              {selectedGuruDetail?.myPresensi?.length === 0 ? (
                <Text style={styles.emptyText}>Tidak ada catatan kehadiran bulan ini.</Text>
              ) : (
                selectedGuruDetail?.myPresensi?.map((p: any, i: number) => (
                  <View key={i} style={styles.logRow}>
                    <View>
                      <Text style={styles.logDate}>{p.tanggal}</Text>
                      <Text style={styles.logTime}>{p.waktu_datang || '--:--'} s/d {p.waktu_pulang || '--:--'}</Text>
                    </View>
                    <Text style={styles.logMoney}>Rp {(Number(p.honor_kehadiran) || 0).toLocaleString('id-ID')}</Text>
                  </View>
                ))
              )}

              {/* Log KBM */}
              <Text style={[styles.logSectionTitle, { marginTop: 14 }]}>Log Mengajar KBM ({selectedGuruDetail?.totalJp} JP)</Text>
              {selectedGuruDetail?.myKbm?.length === 0 ? (
                <Text style={styles.emptyText}>Tidak ada catatan jam mengajar bulan ini.</Text>
              ) : (
                selectedGuruDetail?.myKbm?.map((k: any, i: number) => (
                  <View key={i} style={styles.logRow}>
                    <View>
                      <Text style={styles.logDate}>{k.tanggal} (Jam Ke: {k.jam_ke || '1'})</Text>
                      <Text style={styles.logTime}>{k.waktu_masuk} - {k.waktu_keluar || '...'} {k.is_pengganti ? '[Inval]' : ''}</Text>
                    </View>
                    <Text style={[styles.logMoney, { color: '#4338ca' }]}>Rp {((Number(k.jumlah_jp) || 1) * 6500).toLocaleString('id-ID')}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    backgroundColor: '#1E257F',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: { padding: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  filterCard: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4B5563',
    textTransform: 'uppercase'
  },
  filterDropdownRow: {
    flexDirection: 'row',
    gap: 10
  },
  pickerWrapper: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 52
  },
  picker: {
    width: '100%',
    height: 52,
    color: '#1F2937'
  },
  content: { padding: 16, paddingBottom: 60 },
  summaryCard: {
    backgroundColor: '#059669',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4
  },
  summaryLabel: { color: '#D1FAE5', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  summaryValue: { color: '#fff', fontSize: 24, fontWeight: '900', marginVertical: 4 },
  summaryMetaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  summaryMetaText: { color: '#A7F3D0', fontSize: 11 },
  btnCetakSemua: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  btnCetakSemuaText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#065F46'
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1F2937' },
  guruList: { gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  guruName: { fontSize: 15, fontWeight: 'bold', color: '#1F2937' },
  guruNip: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  totalBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  totalBadgeText: { fontSize: 13, fontWeight: '900', color: '#065F46' },
  breakdownGrid: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 8,
    gap: 4
  },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownLabel: { fontSize: 8, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase' },
  breakdownVal: { fontSize: 11, fontWeight: 'bold', color: '#1F2937', marginTop: 2 },
  breakdownSub: { fontSize: 9, color: '#059669', fontWeight: '600' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 12 },
  btnApresiasi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE'
  },
  btnApresiasiText: { fontSize: 11, fontWeight: 'bold', color: '#7C3AED' },
  btnDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8
  },
  btnDetailText: { fontSize: 11, fontWeight: 'bold', color: '#1E257F' },
  btnSlip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8
  },
  btnSlipText: { fontSize: 11, fontWeight: 'bold', color: '#059669' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCardCenter: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  modalSub: { fontSize: 12, color: '#6B7280' },
  modalSummary: { backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  modalSumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalSumLabel: { fontSize: 12, color: '#374151' },
  modalSumVal: { fontSize: 12, fontWeight: 'bold', color: '#1F2937' },
  modalSumKet: { fontSize: 11, fontStyle: 'italic', color: '#6B7280', marginTop: 2, marginBottom: 4 },
  logSectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', marginBottom: 8 },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 10, borderRadius: 10, marginBottom: 6 },
  logDate: { fontSize: 12, fontWeight: 'bold', color: '#1F2937' },
  logTime: { fontSize: 10, color: '#6B7280' },
  logMoney: { fontSize: 12, fontWeight: 'bold', color: '#059669' },
  emptyText: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 10 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#374151', marginBottom: 4 },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1F2937'
  },
  inputHint: { fontSize: 10, color: '#9CA3AF', marginTop: 3 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  btnCancel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F3F4F6' },
  btnCancelText: { fontSize: 12, fontWeight: 'bold', color: '#4B5563' },
  btnSave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#059669'
  },
  btnSaveText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  crudFormBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10
  },
  crudItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  crudItemTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  crudItemSub: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 2
  }
});
