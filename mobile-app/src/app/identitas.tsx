import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, 
  DeviceEventEmitter, ToastAndroid, Platform, TextInput, Modal, 
  KeyboardAvoidingView, Alert, Linking, Image 
} from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { 
  Building2, MapPin, User, FileDigit, ArrowLeft, Edit2, Save, X, 
  ShieldCheck, Landmark, Phone, Mail, Globe, FileText, ExternalLink, 
  CheckCircle2, Award, Calendar, ChevronRight 
} from 'lucide-react-native';
import { router } from 'expo-router';

export default function IdentitasLembaga() {
  const [currentTab, setCurrentTab] = useState<'identitas' | 'legalitas_lembaga' | 'legalitas_yayasan'>('identitas');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State for Editing Identitas Pokok
  const [formData, setFormData] = useState({
    nama_lembaga: '',
    npsn: '',
    bentuk_pendidikan: 'SMP',
    status_sekolah: 'Swasta',
    akreditasi: 'A',
    kurikulum: 'Kurikulum Merdeka',
    telepon: '',
    email: '',
    website: '',
    kepala_sekolah: '',
    nip_kepsek: '',
    alamat: '',
    rt: '',
    rw: '',
    dusun: '',
    desa: '',
    kecamatan: '',
    kabupaten: '',
    provinsi: '',
    kode_pos: '',
    nama_yayasan: '',
    ketua_yayasan: ''
  });

  useEffect(() => {
    fetchLembaga();

    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      if (Platform.OS === 'android') { 
        ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); 
      }
      fetchLembaga();
    });

    return () => listener.remove();
  }, []);

  const fetchLembaga = async () => {
    try {
      const { data: lembagaData, error } = await supabase
        .from('data_lembaga')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (lembagaData) setData(lembagaData);
    } catch (err) {
      console.error('Error fetching data lembaga:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = () => {
    setFormData({
      nama_lembaga: data?.nama_lembaga || '',
      npsn: data?.npsn || '',
      bentuk_pendidikan: data?.bentuk_pendidikan || 'SMP',
      status_sekolah: data?.status_sekolah || 'Swasta',
      akreditasi: data?.akreditasi || 'A',
      kurikulum: data?.kurikulum || 'Kurikulum Merdeka',
      telepon: data?.telepon || '',
      email: data?.email || '',
      website: data?.website || '',
      kepala_sekolah: data?.kepala_sekolah || '',
      nip_kepsek: data?.nip_kepsek || '',
      alamat: data?.alamat || '',
      rt: data?.rt || '',
      rw: data?.rw || '',
      dusun: data?.dusun || '',
      desa: data?.desa || '',
      kecamatan: data?.kecamatan || '',
      kabupaten: data?.kabupaten || '',
      provinsi: data?.provinsi || '',
      kode_pos: data?.kode_pos || '',
      nama_yayasan: data?.nama_yayasan || '',
      ketua_yayasan: data?.ketua_yayasan || ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!data?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('data_lembaga')
        .update(formData)
        .eq('id', data.id);

      if (error) throw error;

      Alert.alert('Berhasil', 'Identitas lembaga berhasil diperbarui');
      setIsEditing(false);
      fetchLembaga();
    } catch (err: any) {
      console.error('Save error:', err);
      Alert.alert('Error', err?.message || 'Gagal memperbarui identitas lembaga');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenFile = (url: string, title?: string) => {
    if (!url) {
      Alert.alert('Berkas Belum Tersedia', 'Belum ada berkas fisik yang diunggah untuk item ini.');
      return;
    }
    Linking.openURL(url).catch(err => {
      Alert.alert('Gagal Membuka File', 'Tidak dapat membuka tautan file di browser.');
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2a2c87" />
        <Text style={{ marginTop: 12, color: '#6b7280', fontSize: 13 }}>Memuat identitas lembaga...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ color: '#6b7280', fontSize: 15 }}>Data lembaga tidak ditemukan.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const legalitasLembaga = data.legalitas_lembaga || {};
  const legalitasYayasan = data.legalitas_yayasan || {};
  const dokTambahanLembaga = Array.isArray(data.dokumen_tambahan_lembaga) ? data.dokumen_tambahan_lembaga : [];
  const dokTambahanYayasan = Array.isArray(data.dokumen_tambahan_yayasan) ? data.dokumen_tambahan_yayasan : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Identitas & Legalitas</Text>
          <Text style={styles.headerSubtitle}>Profil Sekolah & Badan Hukum</Text>
        </View>
      </View>

      {/* Tab Switcher - Styled as Presensi Siswa */}
      <View style={styles.tabWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, currentTab === 'identitas' && styles.tabBtnActive]} 
            onPress={() => setCurrentTab('identitas')}
          >
            <Building2 size={16} color={currentTab === 'identitas' ? '#2a2c87' : '#9ca3af'} />
            <Text style={[styles.tabText, currentTab === 'identitas' && styles.tabTextActive]}>Identitas</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabBtn, currentTab === 'legalitas_lembaga' && styles.tabBtnActive]} 
            onPress={() => setCurrentTab('legalitas_lembaga')}
          >
            <ShieldCheck size={16} color={currentTab === 'legalitas_lembaga' ? '#2a2c87' : '#9ca3af'} />
            <Text style={[styles.tabText, currentTab === 'legalitas_lembaga' && styles.tabTextActive]}>Legalitas Sekolah</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabBtn, currentTab === 'legalitas_yayasan' && styles.tabBtnActive]} 
            onPress={() => setCurrentTab('legalitas_yayasan')}
          >
            <Landmark size={16} color={currentTab === 'legalitas_yayasan' ? '#2a2c87' : '#9ca3af'} />
            <Text style={[styles.tabText, currentTab === 'legalitas_yayasan' && styles.tabTextActive]}>Legalitas Yayasan</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ========================================================================= */}
        {/* TAB 1: IDENTITAS LEMBAGA */}
        {/* ========================================================================= */}
        {currentTab === 'identitas' && (
          <View style={{ gap: 16 }}>
            {/* Main Header Card */}
            <View style={styles.card}>
              <View style={styles.logoContainer}>
                {data.logo_url ? (
                  <Image source={{ uri: data.logo_url }} style={styles.logoImage} resizeMode="contain" />
                ) : (
                  <Building2 size={48} color="#2a2c87" />
                )}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', textAlign: 'center', marginTop: 8, letterSpacing: 0.5 }}>
                {data.nama_yayasan || 'Yayasan Hidayatul Mubtadi-ien'}
              </Text>
              <Text style={[styles.schoolName, { marginTop: 2 }]}>{data.nama_lembaga || '-'}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>NPSN: {data.npsn || '-'}</Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: '#fef3c7' }]}>
                  <Text style={[styles.badgePillText, { color: '#92400e' }]}>Akreditasi {data.akreditasi || 'A'}</Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: '#ecfdf5' }]}>
                  <Text style={[styles.badgePillText, { color: '#065f46' }]}>{data.status_sekolah || 'Swasta'}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Landmark size={18} color="#2a2c87" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Yayasan Penyelenggara</Text>
                  <Text style={styles.infoValue}>{data.nama_yayasan || '-'}</Text>
                  {data.ketua_yayasan ? <Text style={styles.infoSub}>Ketua: {data.ketua_yayasan}</Text> : null}
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <User size={18} color="#2a2c87" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Kepala Sekolah</Text>
                  <Text style={styles.infoValue}>{data.kepala_sekolah || '-'}</Text>
                  <Text style={styles.infoSub}>NIP: {data.nip_kepsek || '-'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Award size={18} color="#2a2c87" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Jenjang & Kurikulum</Text>
                  <Text style={styles.infoValue}>{data.bentuk_pendidikan || 'SMP'} • {data.kurikulum || 'Kurikulum Merdeka'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <MapPin size={18} color="#2a2c87" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Alamat Lengkap</Text>
                  <Text style={styles.infoValue}>{data.alamat || '-'}</Text>
                  {(data.desa || data.kecamatan) && (
                    <Text style={styles.infoSub}>
                      Desa {data.desa || '-'}, Kec. {data.kecamatan || '-'}, {data.kabupaten || '-'} ({data.kode_pos || '-'})
                    </Text>
                  )}
                </View>
              </View>

              {/* Kontak */}
              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Phone size={18} color="#2a2c87" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Telepon / WhatsApp</Text>
                  <Text style={styles.infoValue}>{data.telepon || '-'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Mail size={18} color="#2a2c87" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Email Resmi</Text>
                  <Text style={styles.infoValue}>{data.email || '-'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Globe size={18} color="#2a2c87" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Website / Portal</Text>
                  <Text style={styles.infoValue}>{data.website || '-'}</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.editBtnFull} onPress={handleOpenEdit}>
                <Edit2 color="#4f46e5" size={18} style={{ marginRight: 8 }} />
                <Text style={styles.editBtnFullText}>Edit Data Identitas</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: LEGALITAS LEMBAGA */}
        {/* ========================================================================= */}
        {currentTab === 'legalitas_lembaga' && (
          <View style={{ gap: 14 }}>
            {/* 1. SK Pendirian */}
            <View style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={styles.docNumberBadge}><Text style={styles.docNumberText}>1</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>SK Pendirian Sekolah</Text>
                  <Text style={styles.docSub}>{legalitasLembaga.sk_pendirian?.nomor || 'Nomor SK belum diisi'}</Text>
                </View>
              </View>
              <View style={styles.docMetaRow}>
                <Text style={styles.docMetaText}>📅 {legalitasLembaga.sk_pendirian?.tanggal || '-'}</Text>
                <Text style={styles.docMetaText}>🏢 {legalitasLembaga.sk_pendirian?.penerbit || 'Dinas Pendidikan'}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.btnDocAction, !legalitasLembaga.sk_pendirian?.file_url && styles.btnDocDisabled]}
                onPress={() => handleOpenFile(legalitasLembaga.sk_pendirian?.file_url, 'SK Pendirian')}
              >
                <FileText size={15} color={legalitasLembaga.sk_pendirian?.file_url ? '#2a2c87' : '#9ca3af'} />
                <Text style={[styles.btnDocText, !legalitasLembaga.sk_pendirian?.file_url && { color: '#9ca3af' }]}>
                  {legalitasLembaga.sk_pendirian?.file_url ? 'Lihat Dokumen SK' : 'Belum Ada Berkas'}
                </Text>
                {legalitasLembaga.sk_pendirian?.file_url && <ExternalLink size={14} color="#2a2c87" />}
              </TouchableOpacity>
            </View>

            {/* 2. SK Izin Operasional */}
            <View style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={[styles.docNumberBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                  <Text style={[styles.docNumberText, { color: '#065f46' }]}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>SK Izin Operasional</Text>
                  <Text style={styles.docSub}>{legalitasLembaga.sk_operasional?.nomor || 'Nomor Izin belum diisi'}</Text>
                </View>
              </View>
              <View style={styles.docMetaRow}>
                <Text style={styles.docMetaText}>📅 {legalitasLembaga.sk_operasional?.tanggal || '-'}</Text>
                <Text style={styles.docMetaText}>⏳ {legalitasLembaga.sk_operasional?.masa_berlaku || 'Berlaku Selamanya'}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.btnDocAction, !legalitasLembaga.sk_operasional?.file_url && styles.btnDocDisabled]}
                onPress={() => handleOpenFile(legalitasLembaga.sk_operasional?.file_url, 'SK Izin Operasional')}
              >
                <FileText size={15} color={legalitasLembaga.sk_operasional?.file_url ? '#2a2c87' : '#9ca3af'} />
                <Text style={[styles.btnDocText, !legalitasLembaga.sk_operasional?.file_url && { color: '#9ca3af' }]}>
                  {legalitasLembaga.sk_operasional?.file_url ? 'Lihat Dokumen Izin' : 'Belum Ada Berkas'}
                </Text>
                {legalitasLembaga.sk_operasional?.file_url && <ExternalLink size={14} color="#2a2c87" />}
              </TouchableOpacity>
            </View>

            {/* 3. Sertifikat Akreditasi */}
            <View style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={[styles.docNumberBadge, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                  <Text style={[styles.docNumberText, { color: '#6b21a8' }]}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>Sertifikat Akreditasi (BAN-S/M)</Text>
                  <Text style={styles.docSub}>{legalitasLembaga.akreditasi?.nomor || 'Nomor Sertifikat belum diisi'}</Text>
                </View>
              </View>
              <View style={styles.docMetaRow}>
                <Text style={styles.docMetaText}>⭐ {legalitasLembaga.akreditasi?.peringkat || 'Peringkat A'}</Text>
                <Text style={styles.docMetaText}>📅 Hingga: {legalitasLembaga.akreditasi?.berlaku_sampai || '-'}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.btnDocAction, !legalitasLembaga.akreditasi?.file_url && styles.btnDocDisabled]}
                onPress={() => handleOpenFile(legalitasLembaga.akreditasi?.file_url, 'Sertifikat Akreditasi')}
              >
                <FileText size={15} color={legalitasLembaga.akreditasi?.file_url ? '#2a2c87' : '#9ca3af'} />
                <Text style={[styles.btnDocText, !legalitasLembaga.akreditasi?.file_url && { color: '#9ca3af' }]}>
                  {legalitasLembaga.akreditasi?.file_url ? 'Lihat Sertifikat' : 'Belum Ada Berkas'}
                </Text>
                {legalitasLembaga.akreditasi?.file_url && <ExternalLink size={14} color="#2a2c87" />}
              </TouchableOpacity>
            </View>

            {/* 4. NPWP Lembaga */}
            <View style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={[styles.docNumberBadge, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                  <Text style={[styles.docNumberText, { color: '#b45309' }]}>4</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>NPWP Sekolah / Lembaga</Text>
                  <Text style={styles.docSub}>{legalitasLembaga.npwp?.nomor || 'Nomor NPWP belum diisi'}</Text>
                </View>
              </View>
              <View style={styles.docMetaRow}>
                <Text style={styles.docMetaText}>👤 {legalitasLembaga.npwp?.nama || data.nama_lembaga || '-'}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.btnDocAction, !legalitasLembaga.npwp?.file_url && styles.btnDocDisabled]}
                onPress={() => handleOpenFile(legalitasLembaga.npwp?.file_url, 'NPWP Sekolah')}
              >
                <FileText size={15} color={legalitasLembaga.npwp?.file_url ? '#2a2c87' : '#9ca3af'} />
                <Text style={[styles.btnDocText, !legalitasLembaga.npwp?.file_url && { color: '#9ca3af' }]}>
                  {legalitasLembaga.npwp?.file_url ? 'Lihat Berkas NPWP' : 'Belum Ada Berkas'}
                </Text>
                {legalitasLembaga.npwp?.file_url && <ExternalLink size={14} color="#2a2c87" />}
              </TouchableOpacity>
            </View>

            {/* 5. Piagam NPSN */}
            <View style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={[styles.docNumberBadge, { backgroundColor: '#f0fdfa', borderColor: '#99f6e4' }]}>
                  <Text style={[styles.docNumberText, { color: '#0f766e' }]}>5</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>Piagam / Sertifikat NPSN</Text>
                  <Text style={styles.docSub}>NPSN Resmi: {data.npsn || '-'}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.btnDocAction, !legalitasLembaga.piagam_npsn?.file_url && styles.btnDocDisabled]}
                onPress={() => handleOpenFile(legalitasLembaga.piagam_npsn?.file_url, 'Piagam NPSN')}
              >
                <FileText size={15} color={legalitasLembaga.piagam_npsn?.file_url ? '#2a2c87' : '#9ca3af'} />
                <Text style={[styles.btnDocText, !legalitasLembaga.piagam_npsn?.file_url && { color: '#9ca3af' }]}>
                  {legalitasLembaga.piagam_npsn?.file_url ? 'Lihat Piagam NPSN' : 'Belum Ada Berkas'}
                </Text>
                {legalitasLembaga.piagam_npsn?.file_url && <ExternalLink size={14} color="#2a2c87" />}
              </TouchableOpacity>
            </View>

            {/* Dokumen Tambahan Lembaga */}
            {dokTambahanLembaga.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.sectionHeaderTitle}>Dokumen Tambahan Sekolah ({dokTambahanLembaga.length})</Text>
                {dokTambahanLembaga.map((item: any, idx: number) => (
                  <View key={idx} style={[styles.docCard, { marginTop: 8 }]}>
                    <Text style={styles.docTitle}>{item.judul || `Dokumen Tambahan #${idx + 1}`}</Text>
                    <Text style={styles.docSub}>{item.nomor || 'Tanpa Nomor'}</Text>
                    {item.keterangan && <Text style={styles.docMetaText}>📝 {item.keterangan}</Text>}
                    <TouchableOpacity 
                      style={[styles.btnDocAction, !item.file_url && styles.btnDocDisabled]}
                      onPress={() => handleOpenFile(item.file_url, item.judul)}
                    >
                      <FileText size={15} color={item.file_url ? '#2a2c87' : '#9ca3af'} />
                      <Text style={[styles.btnDocText, !item.file_url && { color: '#9ca3af' }]}>
                        {item.file_url ? 'Lihat Dokumen' : 'Belum Ada Berkas'}
                      </Text>
                      {item.file_url && <ExternalLink size={14} color="#2a2c87" />}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LEGALITAS YAYASAN */}
        {/* ========================================================================= */}
        {currentTab === 'legalitas_yayasan' && (
          <View style={{ gap: 14 }}>
            {/* Profil Yayasan Card */}
            <View style={styles.card}>
              <View style={[styles.iconBox, { width: 52, height: 52, borderRadius: 26, backgroundColor: '#eef2ff' }]}>
                <Landmark size={28} color="#2a2c87" />
              </View>
              <Text style={styles.schoolName}>{data.nama_yayasan || 'Yayasan Penyelenggara'}</Text>
              <Text style={styles.schoolNpsn}>Ketua Yayasan: {data.ketua_yayasan || '-'}</Text>
              
              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <MapPin size={18} color="#2a2c87" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Alamat Sekretariat Yayasan</Text>
                  <Text style={styles.infoValue}>{legalitasYayasan.alamat_yayasan || '-'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Phone size={18} color="#2a2c87" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Kontak Yayasan</Text>
                  <Text style={styles.infoValue}>{legalitasYayasan.kontak_yayasan || '-'}</Text>
                </View>
              </View>
            </View>

            {/* 1. Akta Notaris */}
            <View style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={styles.docNumberBadge}><Text style={styles.docNumberText}>1</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>Akta Pendirian Notaris</Text>
                  <Text style={styles.docSub}>{legalitasYayasan.akta_pendirian?.nomor || 'Nomor Akta belum diisi'}</Text>
                </View>
              </View>
              <View style={styles.docMetaRow}>
                <Text style={styles.docMetaText}>⚖️ Notaris: {legalitasYayasan.akta_pendirian?.notaris || '-'}</Text>
                <Text style={styles.docMetaText}>📅 {legalitasYayasan.akta_pendirian?.tanggal || '-'}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.btnDocAction, !legalitasYayasan.akta_pendirian?.file_url && styles.btnDocDisabled]}
                onPress={() => handleOpenFile(legalitasYayasan.akta_pendirian?.file_url, 'Akta Pendirian Yayasan')}
              >
                <FileText size={15} color={legalitasYayasan.akta_pendirian?.file_url ? '#2a2c87' : '#9ca3af'} />
                <Text style={[styles.btnDocText, !legalitasYayasan.akta_pendirian?.file_url && { color: '#9ca3af' }]}>
                  {legalitasYayasan.akta_pendirian?.file_url ? 'Lihat Dokumen Akta' : 'Belum Ada Berkas'}
                </Text>
                {legalitasYayasan.akta_pendirian?.file_url && <ExternalLink size={14} color="#2a2c87" />}
              </TouchableOpacity>
            </View>

            {/* 2. SK Kemenkumham */}
            <View style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={[styles.docNumberBadge, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <Text style={[styles.docNumberText, { color: '#b91c1c' }]}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>SK Pengesahan Kemenkumham RI</Text>
                  <Text style={styles.docSub}>{legalitasYayasan.sk_kemenkumham?.nomor || 'Nomor SK belum diisi'}</Text>
                </View>
              </View>
              <View style={styles.docMetaRow}>
                <Text style={styles.docMetaText}>📅 Tanggal: {legalitasYayasan.sk_kemenkumham?.tanggal || '-'}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.btnDocAction, !legalitasYayasan.sk_kemenkumham?.file_url && styles.btnDocDisabled]}
                onPress={() => handleOpenFile(legalitasYayasan.sk_kemenkumham?.file_url, 'SK Kemenkumham')}
              >
                <FileText size={15} color={legalitasYayasan.sk_kemenkumham?.file_url ? '#2a2c87' : '#9ca3af'} />
                <Text style={[styles.btnDocText, !legalitasYayasan.sk_kemenkumham?.file_url && { color: '#9ca3af' }]}>
                  {legalitasYayasan.sk_kemenkumham?.file_url ? 'Lihat SK Kemenkumham' : 'Belum Ada Berkas'}
                </Text>
                {legalitasYayasan.sk_kemenkumham?.file_url && <ExternalLink size={14} color="#2a2c87" />}
              </TouchableOpacity>
            </View>

            {/* 3. NPWP Yayasan */}
            <View style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={[styles.docNumberBadge, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                  <Text style={[styles.docNumberText, { color: '#b45309' }]}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>NPWP Yayasan</Text>
                  <Text style={styles.docSub}>{legalitasYayasan.npwp?.nomor || 'Nomor NPWP belum diisi'}</Text>
                </View>
              </View>
              <View style={styles.docMetaRow}>
                <Text style={styles.docMetaText}>👤 {legalitasYayasan.npwp?.nama || data.nama_yayasan || '-'}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.btnDocAction, !legalitasYayasan.npwp?.file_url && styles.btnDocDisabled]}
                onPress={() => handleOpenFile(legalitasYayasan.npwp?.file_url, 'NPWP Yayasan')}
              >
                <FileText size={15} color={legalitasYayasan.npwp?.file_url ? '#2a2c87' : '#9ca3af'} />
                <Text style={[styles.btnDocText, !legalitasYayasan.npwp?.file_url && { color: '#9ca3af' }]}>
                  {legalitasYayasan.npwp?.file_url ? 'Lihat NPWP Yayasan' : 'Belum Ada Berkas'}
                </Text>
                {legalitasYayasan.npwp?.file_url && <ExternalLink size={14} color="#2a2c87" />}
              </TouchableOpacity>
            </View>

            {/* 4. Tanah & Sertifikat / Wakaf */}
            <View style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={[styles.docNumberBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                  <Text style={[styles.docNumberText, { color: '#065f46' }]}>4</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>Status Kepemilikan Lahan / Wakaf</Text>
                  <Text style={styles.docSub}>{legalitasYayasan.tanah?.jenis || 'Wakaf'} • {legalitasYayasan.tanah?.luas ? `${legalitasYayasan.tanah.luas} m²` : '-'}</Text>
                </View>
              </View>
              <View style={styles.docMetaRow}>
                <Text style={styles.docMetaText}>📜 No: {legalitasYayasan.tanah?.nomor || '-'}</Text>
                <Text style={styles.docMetaText}>👤 Atas Nama: {legalitasYayasan.tanah?.atas_nama || '-'}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.btnDocAction, !legalitasYayasan.tanah?.file_url && styles.btnDocDisabled]}
                onPress={() => handleOpenFile(legalitasYayasan.tanah?.file_url, 'Sertifikat Tanah / Wakaf')}
              >
                <FileText size={15} color={legalitasYayasan.tanah?.file_url ? '#2a2c87' : '#9ca3af'} />
                <Text style={[styles.btnDocText, !legalitasYayasan.tanah?.file_url && { color: '#9ca3af' }]}>
                  {legalitasYayasan.tanah?.file_url ? 'Lihat Akta / Sertifikat' : 'Belum Ada Berkas'}
                </Text>
                {legalitasYayasan.tanah?.file_url && <ExternalLink size={14} color="#2a2c87" />}
              </TouchableOpacity>
            </View>

            {/* Dokumen Tambahan Yayasan */}
            {dokTambahanYayasan.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.sectionHeaderTitle}>Dokumen Tambahan Yayasan ({dokTambahanYayasan.length})</Text>
                {dokTambahanYayasan.map((item: any, idx: number) => (
                  <View key={idx} style={[styles.docCard, { marginTop: 8 }]}>
                    <Text style={styles.docTitle}>{item.judul || `Dokumen Yayasan #${idx + 1}`}</Text>
                    <Text style={styles.docSub}>{item.nomor || 'Tanpa Nomor'}</Text>
                    {item.keterangan && <Text style={styles.docMetaText}>📝 {item.keterangan}</Text>}
                    <TouchableOpacity 
                      style={[styles.btnDocAction, !item.file_url && styles.btnDocDisabled]}
                      onPress={() => handleOpenFile(item.file_url, item.judul)}
                    >
                      <FileText size={15} color={item.file_url ? '#2a2c87' : '#9ca3af'} />
                      <Text style={[styles.btnDocText, !item.file_url && { color: '#9ca3af' }]}>
                        {item.file_url ? 'Lihat Dokumen' : 'Belum Ada Berkas'}
                      </Text>
                      {item.file_url && <ExternalLink size={14} color="#2a2c87" />}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal Edit Identitas Pokok */}
      <Modal visible={isEditing} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Identitas Lembaga</Text>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <X color="#6b7280" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 20 }}>
              <Text style={styles.inputLabel}>Nama Yayasan Penyelenggara *</Text>
              <TextInput style={styles.input} value={formData.nama_yayasan} onChangeText={t => setFormData({...formData, nama_yayasan: t})} placeholder="Misal: Yayasan Hidayatul Mubtadi-ien" />

              <Text style={styles.inputLabel}>Nama Lembaga / Sekolah *</Text>
              <TextInput style={styles.input} value={formData.nama_lembaga} onChangeText={t => setFormData({...formData, nama_lembaga: t})} placeholder="Nama sekolah" />

              <Text style={styles.inputLabel}>NPSN *</Text>
              <TextInput style={styles.input} value={formData.npsn} onChangeText={t => setFormData({...formData, npsn: t})} placeholder="NPSN" keyboardType="numeric" />

              <Text style={styles.inputLabel}>Kepala Sekolah</Text>
              <TextInput style={styles.input} value={formData.kepala_sekolah} onChangeText={t => setFormData({...formData, kepala_sekolah: t})} placeholder="Nama Kepala Sekolah" />

              <Text style={styles.inputLabel}>NIP / NIY Kepala Sekolah</Text>
              <TextInput style={styles.input} value={formData.nip_kepsek} onChangeText={t => setFormData({...formData, nip_kepsek: t})} placeholder="NIP" />

              <Text style={styles.inputLabel}>Telepon / WhatsApp</Text>
              <TextInput style={styles.input} value={formData.telepon} onChangeText={t => setFormData({...formData, telepon: t})} placeholder="0812-xxxx-xxxx" keyboardType="phone-pad" />

              <Text style={styles.inputLabel}>Email Resmi</Text>
              <TextInput style={styles.input} value={formData.email} onChangeText={t => setFormData({...formData, email: t})} placeholder="email@sekolah.sch.id" keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.inputLabel}>Website</Text>
              <TextInput style={styles.input} value={formData.website} onChangeText={t => setFormData({...formData, website: t})} placeholder="https://..." autoCapitalize="none" />

              <Text style={styles.inputLabel}>Alamat Lengkap</Text>
              <TextInput style={styles.input} value={formData.alamat} onChangeText={t => setFormData({...formData, alamat: t})} placeholder="Alamat jalan / RT / RW" multiline numberOfLines={3} textAlignVertical="top" />

              <Text style={styles.inputLabel}>Nama Yayasan Penyelenggara</Text>
              <TextInput style={styles.input} value={formData.nama_yayasan} onChangeText={t => setFormData({...formData, nama_yayasan: t})} placeholder="Nama Yayasan" />

              <Text style={styles.inputLabel}>Ketua Yayasan</Text>
              <TextInput style={styles.input} value={formData.ketua_yayasan} onChangeText={t => setFormData({...formData, ketua_yayasan: t})} placeholder="Nama Ketua Yayasan" />

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Save color="#fff" size={20} style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  header: {
    backgroundColor: '#2a2c87',
    paddingTop: 56,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBack: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  tabWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#2a2c87',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  logoImage: {
    width: 76,
    height: 76,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  schoolNpsn: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 16,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1d4ed8',
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: '#f1f5f9',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  infoSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  editBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  editBtnFullText: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Doc Cards
  docCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  docNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2a2c87',
  },
  docTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  docSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  docMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    marginBottom: 8,
  },
  docMetaText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  btnDocAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    marginTop: 4,
  },
  btnDocDisabled: {
    opacity: 0.6,
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  btnDocText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2a2c87',
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2a2c87',
    borderRadius: 8,
  },
  backText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 14,
  },
  saveBtn: {
    backgroundColor: '#2a2c87',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  }
});
