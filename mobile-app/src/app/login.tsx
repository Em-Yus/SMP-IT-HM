import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import CryptoJS from 'crypto-js';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Camera & Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const SECRET_KEY = process.env.EXPO_PUBLIC_KARTU_SISWA_SECRET || "KARTU_SISWA_SECRET";

  const [role, setRole] = useState<'siswa' | 'guru'>('siswa');

  const onChangeDate = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDateOfBirth(selectedDate);
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setPassword(`${year}-${month}-${day}`);
    }
  };

  const registerPushToken = async (id: string, isGuru: boolean) => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

        if (token) {
          const pseudoNipd = isGuru ? `GURU_${id}` : id;
          const { data: existing } = await supabase.from('user_push_tokens').select('id').eq('nipd', pseudoNipd).maybeSingle();
          if (existing) {
            await supabase.from('user_push_tokens').update({ expo_push_token: token }).eq('id', existing.id);
          } else {
            const { error } = await supabase.from('user_push_tokens').insert({ nipd: pseudoNipd, expo_push_token: token });
            if (error) {
              console.log('Gagal menyimpan token (mungkin karena foreign key / RLS):', error.message);
            }
          }
        }
      }
    } catch (e) {
      console.log('Error register push token:', e);
    }
  };

  const loginWithDataSiswa = async (siswaData: any) => {
    await AsyncStorage.setItem('user_siswa', JSON.stringify(siswaData));
    await registerPushToken(siswaData.nipd, false);
    router.replace('/(tabs)/dashboard');
  };

  const loginWithDataGuru = async (guruData: any) => {
    await AsyncStorage.setItem('user_guru', JSON.stringify(guruData));
    await registerPushToken(guruData.id, true);
    router.replace('/(guru-tabs)/dashboard');
  };

  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setIsScanning(false);
    setLoading(true);
    
    try {
      const bytes = CryptoJS.AES.decrypt(data, SECRET_KEY);
      const nipd = bytes.toString(CryptoJS.enc.Utf8);

      if (!nipd || nipd === "NO-DATA") {
        throw new Error("QR Code tidak valid atau kosong.");
      }

      const { data: siswaData, error: siswaErr } = await supabase
        .from('data_siswa')
        .select('*')
        .eq('nipd', nipd)
        .maybeSingle();

      if (siswaErr || !siswaData) {
        Alert.alert('Login Gagal', 'Data siswa tidak ditemukan dari QR Code ini.');
      } else {
        await loginWithDataSiswa(siswaData);
      }
    } catch (err) {
      Alert.alert('Scan Gagal', 'QR Code tidak valid. Pastikan ini adalah QR Code Kartu Pelajar yang sah.');
    } finally {
      setLoading(false);
    }
  };

  const toggleScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Izin Ditolak', 'Aplikasi membutuhkan akses kamera untuk memindai QR Code.');
        return;
      }
    }
    setIsScanning(true);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Silakan isi semua bidang kredensial.');
      return;
    }

    setLoading(true);
    try {
      if (role === 'guru') {
        // --- LOGIN GURU ---
        const { data: guruData, error: guruErr } = await supabase
          .from('data_guru')
          .select('*')
          .eq('nik', email)
          .eq('tanggal_lahir', password)
          .maybeSingle();

        if (guruErr || !guruData) {
          Alert.alert('Login Gagal', 'NIK atau Tanggal Lahir Guru salah/tidak ditemukan.');
        } else if (guruData.tanggal_keluar) {
          Alert.alert('Login Ditolak', 'Akun pegawai ini sudah berstatus non-aktif. Silakan hubungi administrator sekolah.');
        } else {
          await loginWithDataGuru(guruData);
        }
      } else {
        // --- LOGIN SISWA ---
        const formattedEmail = email.includes('@') ? email : `${email}@smpithm.local`;

        const { data, error } = await supabase.auth.signInWithPassword({
          email: formattedEmail,
          password,
        });

        if (error) {
          // Fallback check NISN and Tanggal Lahir in data_siswa
          const { data: siswaData, error: siswaErr } = await supabase
            .from('data_siswa')
            .select('*')
            .eq('nisn', email)
            .eq('tanggal_lahir', password)
            .maybeSingle();

          if (siswaErr || !siswaData) {
            Alert.alert('Login Gagal', 'NISN atau Tanggal Lahir salah (Kredensial tidak valid)');
            return;
          }

          await loginWithDataSiswa(siswaData);
          return;
        }

        // Email auth success, fetch profile
        const { data: siswaData } = await supabase
          .from('data_siswa')
          .select('*')
          .eq('email', formattedEmail)
          .maybeSingle();

        if (siswaData) {
          await loginWithDataSiswa(siswaData);
        } else {
          Alert.alert('Akses Ditolak', 'Akun ini bukan akun Siswa.');
          await supabase.auth.signOut();
        }
      }
    } catch (error: any) {
      Alert.alert('Login Gagal', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (isScanning) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView 
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerText}>Arahkan kamera ke QR Code Kartu Pelajar</Text>
          <TouchableOpacity style={styles.cancelScanButton} onPress={() => setIsScanning(false)}>
            <Text style={styles.cancelScanText}>Batal</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Portal {role === 'siswa' ? 'Siswa' : 'Guru'}</Text>
          <Text style={styles.subtitle}>SMP IT Hidayatul Mubtadi-ien</Text>
        </View>

        <View style={styles.roleToggleContainer}>
          <TouchableOpacity 
            style={[styles.roleButton, role === 'siswa' && styles.roleButtonActive]} 
            onPress={() => setRole('siswa')}
          >
            <Text style={[styles.roleButtonText, role === 'siswa' && styles.roleButtonTextActive]}>Siswa</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roleButton, role === 'guru' && styles.roleButtonActive]} 
            onPress={() => setRole('guru')}
          >
            <Text style={[styles.roleButtonText, role === 'guru' && styles.roleButtonTextActive]}>Pegawai / Guru</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{role === 'siswa' ? 'Email / NISN' : 'NIK / NIY'}</Text>
          <TextInput
            style={styles.input}
            placeholder={role === 'siswa' ? "Masukkan NISN atau Email..." : "Masukkan NIK atau NIY..."}
            value={email}
            onChangeText={setEmail}
            keyboardType={role === 'siswa' ? "email-address" : "numeric"}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Tanggal Lahir (Password)</Text>
          <TouchableOpacity 
            style={styles.input} 
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: password ? '#1A1818' : '#ADB5BD', fontSize: 16 }}>
              {password ? password : "Pilih Tanggal Lahir"}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={dateOfBirth}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onChangeDate}
              maximumDate={new Date()}
            />
          )}

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Masuk</Text>
            )}
          </TouchableOpacity>

          {role === 'siswa' && (
            <>
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>ATAU</Text>
                <View style={styles.divider} />
              </View>

              <TouchableOpacity 
                style={styles.scanButton} 
                onPress={toggleScanner}
                disabled={loading}
              >
                <Text style={styles.scanButtonText}>Scan QR Code Kartu</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }} onPress={() => router.push('/pendaftaran' as any)}>
                <Text style={{ color: '#1E257F', fontWeight: 'bold', fontSize: 14 }}>Belum punya akun? Daftar Siswa Baru</Text>
              </TouchableOpacity>
            </>
          )}

          {role === 'guru' && (
            <>
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>ATAU</Text>
                <View style={styles.divider} />
              </View>
              <TouchableOpacity style={{ marginTop: 15, alignItems: 'center', marginBottom: 20 }} onPress={() => router.push('/pendaftaran-guru' as any)}>
                <Text style={{ color: '#84D43F', fontWeight: 'bold', fontSize: 14 }}>Belum terdaftar? Daftar sebagai Guru / Pegawai</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E257F',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#1E257F',
    opacity: 0.8,
  },
  roleToggleContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 24,
    marginHorizontal: 16,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  roleButtonActive: {
    borderBottomColor: '#1E257F',
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6C757D',
  },
  roleButtonTextActive: {
    fontWeight: 'bold',
    color: '#1E257F',
  },
  form: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#1E257F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1818',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#1A1818',
  },
  button: {
    backgroundColor: '#1E257F',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ADB5BD',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#6C757D',
    fontSize: 14,
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: '#84D43F',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#1A1818',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 40,
    alignItems: 'center',
  },
  scannerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 8,
  },
  cancelScanButton: {
    backgroundColor: '#E63946',
    padding: 16,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelScanText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
