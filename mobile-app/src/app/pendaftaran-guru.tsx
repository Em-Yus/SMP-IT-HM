import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabaseClient';
import { ArrowLeft, Save, Camera } from 'lucide-react-native';
import { decode } from 'base64-arraybuffer';
import CustomDatePicker from '../components/CustomDatePicker';

export default function PendaftaranGuruScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nik: '',
    nama: '',
    nip: '',
    nuptk: '',
    niy: '',
    no_wa: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    nama_ibu: '',
    agama: 'Islam',
    status_perkawinan: 'Belum Kawin',
    pendidikan: '',
    alamat: '',
    status_pegawai: 'GTY/PTY',
    tanggal_masuk: new Date().toISOString().split('T')[0]
  });

  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string) => {
    let finalValue = value;
    if (field === 'tempat_lahir' || field === 'nama_ibu' || field === 'alamat') {
      finalValue = value.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    } else if (field === 'nama') {
      finalValue = value.toUpperCase();
    } else if (field === 'nik' || field === 'no_wa') {
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

  const handleSubmit = async () => {
    // Validasi
    if (!formData.nik || formData.nik.length !== 16) {
      Alert.alert('Validasi', 'NIK harus 16 digit angka.');
      return;
    }
    if (!formData.nama || !formData.tempat_lahir || !formData.tanggal_lahir || !formData.nama_ibu || !formData.no_wa || !formData.alamat || !formData.pendidikan) {
      Alert.alert('Validasi', 'Mohon lengkapi semua field yang ditandai bintang (*).');
      return;
    }

    setLoading(true);
    try {
      let fotoUrl = null;

      if (fotoBase64 && fotoUri) {
        const fileExt = fotoUri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `guru_${formData.nik}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('foto_guru')
          .upload(fileName, decode(fotoBase64), {
            contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
            upsert: false
          });

        if (uploadError) {
          throw new Error('Gagal mengupload foto: ' + uploadError.message);
        }

        const { data: pub } = supabase.storage.from('foto_guru').getPublicUrl(fileName);
        fotoUrl = pub.publicUrl;
      }

      // Format wa to 62
      let finalWa = formData.no_wa;
      if (finalWa && finalWa.startsWith('0')) finalWa = '62' + finalWa.substring(1);

      // Auto format field tertentu sebelum simpan
      const finalData: any = {
        ...formData,
        no_wa: finalWa || null,
        nama: formData.nama.toUpperCase(),
        tempat_lahir: toProperCase(formData.tempat_lahir),
        nama_ibu: toProperCase(formData.nama_ibu),
        alamat: toProperCase(formData.alamat),
        foto_url: fotoUrl
      };

      // Set empty strings to null
      Object.keys(finalData).forEach(key => {
        if (finalData[key] === '') finalData[key] = null;
      });

      const { error: dbError } = await supabase
        .from('data_guru')
        .insert([finalData]);

      if (dbError) throw dbError;

      Alert.alert(
        'Pendaftaran Berhasil!',
        'Data Pegawai/Guru berhasil disimpan ke database.',
        [{ text: 'OK', onPress: () => router.push('/') }]
      );
    } catch (err: any) {
      console.error("Error pendaftaran guru:", err);
      Alert.alert('Pendaftaran Gagal', err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pendaftaran Guru</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Identitas Pegawai</Text>

          <Text style={styles.label}>NIK <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="16 digit NIK KTP"
            keyboardType="number-pad"
            maxLength={16}
            value={formData.nik}
            onChangeText={(t) => handleInputChange('nik', t)}
          />

          <Text style={styles.label}>Nama Lengkap (dengan Gelar) <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, { textTransform: 'uppercase' }]}
            placeholder="NAMA LENGKAP"
            autoCapitalize="characters"
            value={formData.nama}
            onChangeText={(t) => handleInputChange('nama', t)}
          />

          <Text style={styles.label}>NIP (Jika Ada)</Text>
          <TextInput
            style={styles.input}
            placeholder="-"
            keyboardType="number-pad"
            value={formData.nip}
            onChangeText={(t) => handleInputChange('nip', t)}
          />

          <Text style={styles.label}>NUPTK (Jika Ada)</Text>
          <TextInput
            style={styles.input}
            placeholder="-"
            keyboardType="number-pad"
            value={formData.nuptk}
            onChangeText={(t) => handleInputChange('nuptk', t)}
          />

          <Text style={styles.label}>NIY (Nomor Induk Yayasan)</Text>
          <TextInput
            style={styles.input}
            placeholder="-"
            value={formData.niy}
            onChangeText={(t) => handleInputChange('niy', t)}
          />

          <Text style={styles.label}>Nomor WhatsApp <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="08xxxxxxxxxx"
            keyboardType="phone-pad"
            value={formData.no_wa}
            onChangeText={(t) => handleInputChange('no_wa', t)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Data Pribadi</Text>

          <Text style={styles.label}>Tempat Lahir <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Tempat Lahir"
            autoCapitalize="words"
            value={formData.tempat_lahir}
            onChangeText={(t) => handleInputChange('tempat_lahir', t)}
          />

          <Text style={styles.label}>Tanggal Lahir <Text style={styles.required}>*</Text></Text>
          <CustomDatePicker 
            value={formData.tanggal_lahir} 
            onChange={(t) => handleInputChange('tanggal_lahir', t)} 
          />

          <Text style={styles.label}>Nama Ibu Kandung <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Nama Ibu Kandung"
            autoCapitalize="words"
            value={formData.nama_ibu}
            onChangeText={(t) => handleInputChange('nama_ibu', t)}
          />

          <Text style={styles.label}>Agama <Text style={styles.required}>*</Text></Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.agama}
              onValueChange={(itemValue) => handleInputChange('agama', itemValue)}
            >
              <Picker.Item label="Islam" value="Islam" />
              <Picker.Item label="Kristen" value="Kristen" />
              <Picker.Item label="Katolik" value="Katolik" />
              <Picker.Item label="Hindu" value="Hindu" />
              <Picker.Item label="Buddha" value="Buddha" />
              <Picker.Item label="Konghucu" value="Konghucu" />
            </Picker>
          </View>

          <Text style={styles.label}>Status Perkawinan <Text style={styles.required}>*</Text></Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.status_perkawinan}
              onValueChange={(itemValue) => handleInputChange('status_perkawinan', itemValue)}
            >
              <Picker.Item label="Belum Kawin" value="Belum Kawin" />
              <Picker.Item label="Kawin" value="Kawin" />
              <Picker.Item label="Cerai Hidup" value="Cerai Hidup" />
              <Picker.Item label="Cerai Mati" value="Cerai Mati" />
            </Picker>
          </View>

          <Text style={styles.label}>Pendidikan Terakhir <Text style={styles.required}>*</Text></Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.pendidikan}
              onValueChange={(itemValue) => handleInputChange('pendidikan', itemValue)}
            >
              <Picker.Item label="-- Pilih --" value="" />
              <Picker.Item label="SMA / SMK / MA" value="SMA/SMK/MA" />
              <Picker.Item label="D1" value="D1" />
              <Picker.Item label="D2" value="D2" />
              <Picker.Item label="D3" value="D3" />
              <Picker.Item label="S1 / D4" value="S1/D4" />
              <Picker.Item label="S2" value="S2" />
              <Picker.Item label="S3" value="S3" />
              <Picker.Item label="Lainnya" value="Lainnya" />
            </Picker>
          </View>

          <Text style={styles.label}>Alamat Lengkap <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Dusun, RT/RW, Desa, Kecamatan, Kab/Kota"
            multiline
            numberOfLines={3}
            autoCapitalize="words"
            value={formData.alamat}
            onChangeText={(t) => handleInputChange('alamat', t)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Kepegawaian</Text>

          <Text style={styles.label}>Status Pegawai <Text style={styles.required}>*</Text></Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.status_pegawai}
              onValueChange={(itemValue) => handleInputChange('status_pegawai', itemValue)}
            >
              <Picker.Item label="GTY / PTY (Tetap Yayasan)" value="GTY/PTY" />
              <Picker.Item label="GTT / PTT (Tidak Tetap)" value="GTT/PTT" />
              <Picker.Item label="Honor Daerah" value="Honor Daerah" />
              <Picker.Item label="PNS DPK" value="PNS" />
            </Picker>
          </View>

          <Text style={styles.label}>Tanggal Masuk <Text style={styles.required}>*</Text></Text>
          <CustomDatePicker 
            value={formData.tanggal_masuk} 
            onChange={(t) => handleInputChange('tanggal_masuk', t)} 
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Foto Profil</Text>
          <TouchableOpacity style={styles.fotoUploadContainer} onPress={pickImage}>
            {fotoUri ? (
              <Image source={{ uri: fotoUri }} style={styles.fotoPreview} />
            ) : (
              <View style={styles.fotoPlaceholder}>
                <Camera color="#9ca3af" size={40} />
                <Text style={styles.fotoPlaceholderText}>Pilih Foto dari Galeri</Text>
                <Text style={styles.fotoPlaceholderSubText}>Rasio 3:4 (Maks. 2MB)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
          ) : (
            <Save color="#fff" size={24} style={{ marginRight: 8 }} />
          )}
          <Text style={styles.submitButtonText}>
            {loading ? 'MENYIMPAN...' : 'SIMPAN DATA PEGAWAI'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: '#2a2c87', 
    paddingTop: 50, 
    paddingBottom: 15, 
    paddingHorizontal: 20 
  },
  backButton: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 15 },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 20, 
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#2a2c87', 
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8
  },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 5, marginTop: 10 },
  required: { color: '#ef4444' },
  input: { 
    borderWidth: 1, 
    borderColor: '#d1d5db', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f9fafb',
    color: '#111827'
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    overflow: 'hidden'
  },
  fotoUploadContainer: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    marginTop: 10
  },
  fotoPlaceholder: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fotoPlaceholderText: {
    marginTop: 10,
    color: '#4b5563',
    fontWeight: '600'
  },
  fotoPlaceholderSubText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 5
  },
  fotoPreview: {
    width: '100%',
    aspectRatio: 3/4,
    resizeMode: 'cover'
  },
  submitButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  submitButtonDisabled: {
    opacity: 0.7
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
