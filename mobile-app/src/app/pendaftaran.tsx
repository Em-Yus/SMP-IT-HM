import React, { useState, useEffect } from 'react';
import {   View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator , DeviceEventEmitter , ToastAndroid, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabaseClient';
import { ArrowLeft, Send, Camera } from 'lucide-react-native';
import { decode } from 'base64-arraybuffer';
import CustomDatePicker from '../components/CustomDatePicker';

export default function PendaftaranScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [kelasList, setKelasList] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    nik: '',
    nisn: '',
    nama: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    jenis_kelamin: '',
    alamat_detail: '',
    rt: '',
    rw: '',
    desa: '',
    kecamatan: '',
    kabupaten: '',
    provinsi: '',
    wa_siswa: '',
    kelas: '',
    angkatan: new Date().getFullYear().toString(),
    tahun_ajaran: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    tanggal_masuk: new Date().toISOString().split('T')[0],
    status_siswa: 'Baru',
    sekolah_asal: '',
    nama_ayah: '',
    nama_ibu: '',
    nama_wali: '',
    wa_ortu: ''
  });

  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);

  useEffect(() => {
    fetchKelas();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\pendaftaran.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchKelas();
  
    });

    return () => listener.remove();
  }, []);

  const fetchKelas = async () => {
    try {
      const { data, error } = await supabase
        .from('data_kelas')
        .select('nama_kelas')
        .order('nama_kelas');
      if (!error && data) {
        setKelasList(data);
      }
    } catch (err) {
      console.error("Gagal memuat kelas:", err);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    let finalValue = value;
    if (['tempat_lahir', 'nama_ibu', 'nama_ayah', 'nama_wali', 'alamat_detail', 'desa', 'kecamatan', 'kabupaten', 'provinsi', 'sekolah_asal'].includes(field)) {
      finalValue = value.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    } else if (field === 'nama') {
      finalValue = value.toUpperCase();
    } else if (['nik', 'nisn', 'wa_ortu', 'wa_siswa', 'rt', 'rw'].includes(field)) {
      finalValue = value.replace(/\D/g, ''); // Only numbers
    }
    
    setFormData(prev => ({ ...prev, [field]: finalValue }));
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Maaf, kami membutuhkan izin galeri untuk mengupload foto.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.5,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFotoUri(result.assets[0].uri);
        setFotoBase64(result.assets[0].base64 || null);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert('Error', 'Gagal memilih foto.');
    }
  };

  const toProperCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
  };

  const generateNoRegString = async () => {
    let digit1_4 = '2526';
    if (formData.tahun_ajaran && formData.tahun_ajaran.includes('/')) {
      const splitTa = formData.tahun_ajaran.split('/');
      const tahun1 = splitTa[0].slice(-2);
      const tahun2 = splitTa[1].slice(-2);
      digit1_4 = tahun1 + tahun2;
    }

    let digit5_6 = '07';
    if (formData.kelas) {
      const kelasStr = String(formData.kelas).toUpperCase();
      if (kelasStr.includes('VIII') || kelasStr.includes('8')) digit5_6 = '08';
      else if (kelasStr.includes('IX') || kelasStr.includes('9')) digit5_6 = '09';
      else if (kelasStr.includes('VII') || kelasStr.includes('7')) digit5_6 = '07';
    }

    try {
      const { count, error } = await supabase
        .from('ppdb_pendaftar')
        .select('*', { count: 'exact', head: true })
        .eq('angkatan', formData.angkatan);
        
      if (error) throw error;
      
      const nomorUrut = String((count || 0) + 1).padStart(3, '0');
      return digit1_4 + digit5_6 + nomorUrut;
    } catch (err) {
      console.error("Gagal generate no registrasi NIPD", err);
      // Fallback
      return `ERR${Date.now().toString().slice(-6)}`;
    }
  };

  const handleSubmit = async () => {
    // Validasi field wajib
    if (!formData.nik || !formData.nama || !formData.tempat_lahir || !formData.tanggal_lahir || !formData.jenis_kelamin || !formData.alamat_detail || !formData.rt || !formData.rw || !formData.desa || !formData.kecamatan || !formData.kabupaten || !formData.provinsi || !formData.kelas || !formData.sekolah_asal || !formData.nama_ayah || !formData.nama_ibu || !formData.wa_ortu) {
      return Alert.alert('Peringatan', 'Harap lengkapi semua field yang bertanda bintang (*)');
    }

    if (formData.nik.length !== 16) {
      return Alert.alert('Peringatan', 'NIK harus terdiri dari 16 digit angka.');
    }

    setLoading(true);

    try {
      let fotoUrl = null;

      // 1. Upload Foto jika ada
      if (fotoBase64) {
        const fileExt = 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `foto_siswa/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('berkas_ppdb')
          .upload(filePath, decode(fotoBase64), {
            contentType: 'image/jpeg'
          });

        if (uploadError) throw new Error('Gagal mengupload foto: ' + uploadError.message);

        const { data: publicUrlData } = supabase.storage
          .from('berkas_ppdb')
          .getPublicUrl(filePath);

        fotoUrl = publicUrlData.publicUrl;
      }

      // 2. Generate No Registrasi
      const generatedNoReg = await generateNoRegString();

      // Format wa to 62
      let finalWaOrtu = formData.wa_ortu;
      if (finalWaOrtu && finalWaOrtu.startsWith('0')) finalWaOrtu = '62' + finalWaOrtu.substring(1);
      
      let finalWaSiswa = formData.wa_siswa;
      if (finalWaSiswa && finalWaSiswa.startsWith('0')) finalWaSiswa = '62' + finalWaSiswa.substring(1);

      // 3. Payload Pendaftar
      const payloadSiswa = {
        no_pendaftaran: generatedNoReg,
        nik: formData.nik,
        nisn: formData.nisn || null,
        nama: toProperCase(formData.nama),
        tempat_lahir: toProperCase(formData.tempat_lahir),
        tanggal_lahir: formData.tanggal_lahir,
        jenis_kelamin: formData.jenis_kelamin,
        alamat_detail: toProperCase(formData.alamat_detail),
        rt: formData.rt,
        rw: formData.rw,
        desa: toProperCase(formData.desa),
        kecamatan: toProperCase(formData.kecamatan),
        kabupaten: toProperCase(formData.kabupaten),
        provinsi: toProperCase(formData.provinsi),
        wa_siswa: finalWaSiswa || null,
        kelas: formData.kelas,
        angkatan: formData.angkatan,
        tahun_ajaran: formData.tahun_ajaran,
        tanggal_masuk: formData.tanggal_masuk,
        status_siswa: formData.status_siswa,
        sekolah_asal: toProperCase(formData.sekolah_asal),
        nama_ayah: toProperCase(formData.nama_ayah),
        nama_ibu: toProperCase(formData.nama_ibu),
        nama_wali: formData.nama_wali ? toProperCase(formData.nama_wali) : null,
        wa_ortu: finalWaOrtu,
        status_berkas: 'Kurang',
        foto_url: fotoUrl
      };

      // Set empty strings to null
      Object.keys(payloadSiswa).forEach(key => {
        if ((payloadSiswa as any)[key] === '') (payloadSiswa as any)[key] = null;
      });

      // 4. Insert ke Supabase
      const { error: errSiswa } = await supabase.from('ppdb_pendaftar').insert([payloadSiswa]);
      
      if (errSiswa) {
        if (errSiswa.code === '23505') {
           throw new Error('Data duplikat terdeteksi (NIK atau NISN sudah terdaftar).');
        }
        throw errSiswa;
      }

      Alert.alert('Berhasil', 'Data pendaftaran siswa baru berhasil dikirim dan tersimpan di sistem.', [
        { text: 'Tutup', onPress: () => router.replace('/login') }
      ]);

    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Gagal menyimpan data pendaftar.');
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const angkatanOptions = [];
  for (let y = currentYear - 3; y <= currentYear + 3; y++) {
    angkatanOptions.push(y.toString());
  }

  const currentMonth = new Date().getMonth();
  let activeTaStartYear = (currentMonth < 6) ? currentYear - 1 : currentYear;
  const taOptions = [];
  for (let y = activeTaStartYear - 3; y <= activeTaStartYear + 3; y++) {
    taOptions.push(`${y}/${y + 1}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={loading}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PPDB Online</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.introBox}>
          <Text style={styles.introTitle}>Formulir Pendaftaran Siswa</Text>
          <Text style={styles.introDesc}>Mohon isi data di bawah ini dengan benar dan lengkap sesuai dokumen asli.</Text>
        </View>

        <View style={styles.formContainer}>
          {/* A. IDENTITAS CALON SISWA */}
          <Text style={styles.sectionTitle}>A. IDENTITAS CALON SISWA</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>NIK <Text style={styles.textRed}>*</Text></Text>
            <TextInput style={styles.input} placeholder="16 digit NIK" keyboardType="numeric" maxLength={16} value={formData.nik} onChangeText={(t) => handleInputChange('nik', t)} />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>NISN</Text>
            <TextInput style={styles.input} placeholder="10 digit NISN" keyboardType="numeric" maxLength={10} value={formData.nisn} onChangeText={(t) => handleInputChange('nisn', t)} />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nama Lengkap <Text style={styles.textRed}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Sesuai Akta Kelahiran" value={formData.nama} onChangeText={(t) => handleInputChange('nama', t)} autoCapitalize="words" />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Tempat Lahir <Text style={styles.textRed}>*</Text></Text>
              <TextInput style={styles.input} placeholder="Kota" value={formData.tempat_lahir} onChangeText={(t) => handleInputChange('tempat_lahir', t)} autoCapitalize="words" />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Tgl Lahir <Text style={styles.textRed}>*</Text></Text>
              <CustomDatePicker 
                value={formData.tanggal_lahir} 
                onChange={(t) => handleInputChange('tanggal_lahir', t)} 
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Jenis Kelamin <Text style={styles.textRed}>*</Text></Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.jenis_kelamin} onValueChange={(val) => handleInputChange('jenis_kelamin', val)}>
                <Picker.Item label="-- Pilih --" value="" />
                <Picker.Item label="Laki-laki" value="Laki-laki" />
                <Picker.Item label="Perempuan" value="Perempuan" />
              </Picker>
            </View>
          </View>

          {/* B. ALAMAT TEMPAT TINGGAL */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>B. ALAMAT TEMPAT TINGGAL</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Jalan / Dusun <Text style={styles.textRed}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Contoh: Dsn. Sukaseneng" value={formData.alamat_detail} onChangeText={(t) => handleInputChange('alamat_detail', t)} autoCapitalize="words" />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>RT <Text style={styles.textRed}>*</Text></Text>
              <TextInput style={styles.input} placeholder="00" keyboardType="numeric" maxLength={3} value={formData.rt} onChangeText={(t) => handleInputChange('rt', t)} />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>RW <Text style={styles.textRed}>*</Text></Text>
              <TextInput style={styles.input} placeholder="00" keyboardType="numeric" maxLength={3} value={formData.rw} onChangeText={(t) => handleInputChange('rw', t)} />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Desa / Kelurahan <Text style={styles.textRed}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Desa" value={formData.desa} onChangeText={(t) => handleInputChange('desa', t)} autoCapitalize="words" />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Kecamatan <Text style={styles.textRed}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Kecamatan" value={formData.kecamatan} onChangeText={(t) => handleInputChange('kecamatan', t)} autoCapitalize="words" />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Kabupaten / Kota <Text style={styles.textRed}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Kabupaten" value={formData.kabupaten} onChangeText={(t) => handleInputChange('kabupaten', t)} autoCapitalize="words" />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Provinsi <Text style={styles.textRed}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Provinsi" value={formData.provinsi} onChangeText={(t) => handleInputChange('provinsi', t)} autoCapitalize="words" />
          </View>

          {/* C. KONTAK SISWA */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>C. KONTAK SISWA</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>No WhatsApp Siswa (Aktif)</Text>
            <TextInput style={styles.input} placeholder="Misal: 62812... atau 6012..." keyboardType="phone-pad" value={formData.wa_siswa} onChangeText={(t) => handleInputChange('wa_siswa', t)} />
          </View>

          {/* D. DATA AKADEMIK */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>D. DATA AKADEMIK</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Daftar Ke Kelas <Text style={styles.textRed}>*</Text></Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.kelas} onValueChange={(val) => handleInputChange('kelas', val)}>
                <Picker.Item label="-- Pilih Kelas --" value="" />
                {kelasList.map((k, i) => (
                  <Picker.Item key={i} label={k.nama_kelas} value={k.nama_kelas} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Angkatan</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={formData.angkatan} onValueChange={(val) => handleInputChange('angkatan', val)}>
                  {angkatanOptions.map(y => <Picker.Item key={y} label={y} value={y} />)}
                </Picker>
              </View>
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Tahun Ajaran</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={formData.tahun_ajaran} onValueChange={(val) => handleInputChange('tahun_ajaran', val)}>
                  {taOptions.map(ta => <Picker.Item key={ta} label={ta} value={ta} />)}
                </Picker>
              </View>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Asal Sekolah (SD/MI) <Text style={styles.textRed}>*</Text></Text>
            <TextInput style={styles.input} placeholder="SDN 1 Compreng" value={formData.sekolah_asal} onChangeText={(t) => handleInputChange('sekolah_asal', t)} autoCapitalize="words" />
          </View>

          {/* E. IDENTITAS ORANG TUA */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>E. IDENTITAS ORANG TUA</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nama Ayah Kandung <Text style={styles.textRed}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Nama Ayah" value={formData.nama_ayah} onChangeText={(t) => handleInputChange('nama_ayah', t)} autoCapitalize="words" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nama Ibu Kandung <Text style={styles.textRed}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Nama Ibu" value={formData.nama_ibu} onChangeText={(t) => handleInputChange('nama_ibu', t)} autoCapitalize="words" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nama Wali (Jika ada)</Text>
            <TextInput style={styles.input} placeholder="Nama Wali" value={formData.nama_wali} onChangeText={(t) => handleInputChange('nama_wali', t)} autoCapitalize="words" />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>No WhatsApp Ortu/Wali <Text style={styles.textRed}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Misal: 62812... atau 6012..." keyboardType="phone-pad" value={formData.wa_ortu} onChangeText={(t) => handleInputChange('wa_ortu', t)} />
            <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Gunakan kode negara (tanpa + atau 0 di awal)</Text>
          </View>

          {/* F. FOTO DIRI */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>F. FOTO DIRI</Text>
          <View style={styles.fotoContainer}>
            <Text style={[styles.label, { textAlign: 'center', marginBottom: 12 }]}>Upload Pas Foto (Maks 2MB)</Text>
            {fotoUri ? (
              <View style={styles.fotoPreviewContainer}>
                <Image source={{ uri: fotoUri }} style={styles.fotoPreview} />
                <TouchableOpacity style={styles.btnGantiFoto} onPress={pickImage}>
                  <Text style={styles.btnGantiFotoText}>Ganti Foto</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.btnUpload} onPress={pickImage}>
                <Camera color="#6b7280" size={32} />
                <Text style={styles.btnUploadText}>Ketuk untuk memilih foto</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.btnSubmit, loading && styles.btnSubmitDisabled]} 
            onPress={handleSubmit} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.btnSubmitText}>KIRIM PENDAFTARAN</Text>
                <Send color="#fff" size={20} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6'
  },
  header: {
    backgroundColor: '#2a2c87',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4
  },
  backBtn: {
    padding: 5
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40
  },
  introBox: {
    backgroundColor: '#eff6ff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  introTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 5,
    textAlign: 'center'
  },
  introDesc: {
    fontSize: 14,
    color: '#3b82f6',
    textAlign: 'center'
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2a2c87',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8
  },
  formGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 6
  },
  textRed: {
    color: '#ef4444'
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f2937'
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden'
  },
  fotoContainer: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    marginBottom: 20
  },
  btnUpload: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30
  },
  btnUploadText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500'
  },
  fotoPreviewContainer: {
    alignItems: 'center'
  },
  fotoPreview: {
    width: 120,
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 10
  },
  btnGantiFoto: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db'
  },
  btnGantiFotoText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '600'
  },
  btnSubmit: {
    backgroundColor: '#85c226',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    elevation: 3,
    shadowColor: '#85c226',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  btnSubmitDisabled: {
    backgroundColor: '#a3d15c',
    elevation: 0
  },
  btnSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10
  }
});
