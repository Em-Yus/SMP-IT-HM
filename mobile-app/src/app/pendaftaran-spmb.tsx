import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { ChevronLeft, Save, FileText, UserPlus, Phone, MapPin, Building, Calendar, User } from 'lucide-react-native';
import { router } from 'expo-router';
import CustomDatePicker from '../components/CustomDatePicker';

export default function PendaftaranSPMB() {
  const [loading, setLoading] = useState(false);
  const [noReg, setNoReg] = useState('Memuat...');
  
  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    alamat_detail: '',
    sekolah_asal: '',
    nama_ayah: '',
    nama_ibu: '',
    wa_ortu: '',
    wa_siswa: ''
  });

  const generateNoRegString = async () => {
    const thn = new Date().getFullYear().toString().slice(-2);
    const prefix = `REG-${thn}-`;
    try {
      const { data, error } = await supabase.from('ppdb_pendaftar').select('no_pendaftaran').like('no_pendaftaran', `${prefix}%`);
      if (error) throw error;
      let maxUrut = 0;
      if (data && data.length > 0) {
        data.forEach(item => {
          if (item.no_pendaftaran) {
            const parts = item.no_pendaftaran.split('-');
            if (parts.length === 3) {
              const num = parseInt(parts[2], 10);
              if (!isNaN(num) && num > maxUrut) maxUrut = num;
            }
          }
        });
      }
      return prefix + (maxUrut + 1).toString().padStart(3, '0');
    } catch (err) {
      console.error("Gagal generate no registrasi", err);
      return 'REG-ERROR';
    }
  };

  const handleInputChange = (field: string, value: string) => {
    let finalValue = value;
    if (['tempat_lahir', 'nama_ibu', 'nama_ayah', 'alamat_detail', 'sekolah_asal'].includes(field)) {
      finalValue = value.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    } else if (field === 'nama') {
      finalValue = value.toUpperCase();
    } else if (['wa_ortu', 'wa_siswa'].includes(field)) {
      finalValue = value.replace(/\D/g, ''); // Only numbers
    }
    
    setFormData(prev => ({ ...prev, [field]: finalValue }));
  };

  const toProperCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
  };

  const handleSubmit = async () => {
    if (!formData.nama || !formData.tempat_lahir || !formData.tanggal_lahir || !formData.alamat_detail || !formData.sekolah_asal || !formData.nama_ayah || !formData.nama_ibu || !formData.wa_ortu) {
      return Alert.alert('Peringatan', 'Harap lengkapi semua field yang bertanda bintang (*)');
    }

    setLoading(true);

    try {
      const generatedNoReg = await generateNoRegString();
      setNoReg(generatedNoReg); // Update UI just in case it's needed

      const payloadSiswa = {
        no_pendaftaran: generatedNoReg,
        nama: toProperCase(formData.nama),
        tempat_lahir: toProperCase(formData.tempat_lahir),
        tanggal_lahir: formData.tanggal_lahir,
        alamat_detail: toProperCase(formData.alamat_detail),
        sekolah_asal: toProperCase(formData.sekolah_asal),
        nama_ayah: toProperCase(formData.nama_ayah),
        nama_ibu: toProperCase(formData.nama_ibu),
        wa_ortu: formData.wa_ortu,
        wa_siswa: formData.wa_siswa || null,
        status_siswa: 'Baru',
        kelas: 'Calon Siswa',
        status_berkas: 'Kurang'
      };

      // Set empty strings to null
      Object.keys(payloadSiswa).forEach(key => {
        if ((payloadSiswa as any)[key] === '') (payloadSiswa as any)[key] = null;
      });

      const { error } = await supabase.from('ppdb_pendaftar').insert([payloadSiswa]);
      if (error) throw error;

      Alert.alert('Berhasil', 'Data calon siswa berhasil disimpan ke database.', [
        { text: 'OK', onPress: () => {
          // Reset form
          setFormData({
            nama: '', tempat_lahir: '', tanggal_lahir: '', alamat_detail: '',
            sekolah_asal: '', nama_ayah: '', nama_ibu: '', wa_ortu: '', wa_siswa: ''
          });
          setNoReg('');
        }}
      ]);

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Gagal menyimpan data pendaftar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Pendaftaran SPMB</Text>
        </View>
        <Text style={styles.headerSubtitle}>Form manual pendaftaran calon siswa</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}><FileText size={20} color="#fff" /></View>
            <Text style={styles.cardTitle}>Biodata Calon Siswa</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nomor Registrasi (Otomatis)</Text>
            <TextInput style={[styles.input, styles.inputDisabled]} value={noReg ? noReg : "Dibuat otomatis saat disimpan"} editable={false} />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nama Lengkap Siswa *</Text>
            <View style={styles.inputIconWrapper}>
              <User size={18} color="#9ca3af" />
              <TextInput style={styles.inputIcon} placeholder="Ketik nama lengkap..." value={formData.nama} onChangeText={(t) => handleInputChange('nama', t)} autoCapitalize="words" />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Tempat Lahir *</Text>
              <TextInput style={styles.input} placeholder="Kota..." value={formData.tempat_lahir} onChangeText={(t) => handleInputChange('tempat_lahir', t)} autoCapitalize="words" />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Tgl Lahir *</Text>
              <CustomDatePicker 
                value={formData.tanggal_lahir} 
                onChange={(t) => handleInputChange('tanggal_lahir', t)} 
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Alamat Lengkap *</Text>
            <View style={styles.textAreaWrapper}>
              <MapPin size={18} color="#9ca3af" style={{ marginTop: 12, marginLeft: 12 }} />
              <TextInput style={styles.textArea} placeholder="Contoh: Jl. Merdeka RT 01..." value={formData.alamat_detail} onChangeText={(t) => handleInputChange('alamat_detail', t)} multiline numberOfLines={3} autoCapitalize="words" />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Asal Sekolah (SD/MI) *</Text>
            <View style={styles.inputIconWrapper}>
              <Building size={18} color="#9ca3af" />
              <TextInput style={styles.inputIcon} placeholder="Contoh: SDN 1 Compreng" value={formData.sekolah_asal} onChangeText={(t) => handleInputChange('sekolah_asal', t)} autoCapitalize="words" />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Nama Ayah *</Text>
              <TextInput style={styles.input} placeholder="Ketik nama..." value={formData.nama_ayah} onChangeText={(t) => handleInputChange('nama_ayah', t)} autoCapitalize="words" />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Nama Ibu *</Text>
              <TextInput style={styles.input} placeholder="Ketik nama..." value={formData.nama_ibu} onChangeText={(t) => handleInputChange('nama_ibu', t)} autoCapitalize="words" />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nomor WA Orang Tua *</Text>
            <View style={styles.inputIconWrapper}>
              <Phone size={18} color="#9ca3af" />
              <TextInput style={styles.inputIcon} placeholder="Contoh: 6281234..." keyboardType="phone-pad" value={formData.wa_ortu} onChangeText={(t) => handleInputChange('wa_ortu', t)} />
            </View>
            <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Tanpa awalan 0, gunakan kode negara</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nomor WA Siswa (Opsional)</Text>
            <View style={styles.inputIconWrapper}>
              <Phone size={18} color="#9ca3af" />
              <TextInput style={styles.inputIcon} placeholder="Contoh: 6281234..." keyboardType="phone-pad" value={formData.wa_siswa} onChangeText={(t) => handleInputChange('wa_siswa', t)} />
            </View>
          </View>

          <TouchableOpacity style={styles.btnSubmit} onPress={handleSubmit} disabled={loading || noReg === 'Memuat...' || noReg === 'REG-ERROR'}>
            {loading ? <ActivityIndicator color="#fff" /> : <><Save size={20} color="#fff" /><Text style={styles.btnSubmitText}>Simpan Pendaftar</Text></>}
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { backgroundColor: '#2a2c87', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { color: '#e0e7ff', fontSize: 13 },
  
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 16 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a2c87', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },

  formGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 14, color: '#1f2937' },
  inputDisabled: { backgroundColor: '#e5e7eb', color: '#4b5563', fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  
  inputIconWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12 },
  inputIcon: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 14, color: '#1f2937' },
  
  textAreaWrapper: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12 },
  textArea: { flex: 1, padding: 12, fontSize: 14, color: '#1f2937', minHeight: 80, textAlignVertical: 'top' },

  btnSubmit: { backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnSubmitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
