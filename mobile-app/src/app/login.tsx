import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Silakan masukkan email dan password');
      return;
    }

    setLoading(true);
    try {
      // Sama seperti di web, jika input hanya angka/NISN, ubah ke format email
      const formattedEmail = email.includes('@') ? email : `${email}@smpithm.local`;

      // Sama seperti di web, login via Supabase auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formattedEmail,
        password,
      });

      if (error) {
        // Fallback: Coba query langsung ke tabel data_siswa (tanpa Supabase Auth)
        const { data: siswaData, error: siswaErr } = await supabase
          .from('data_siswa')
          .select('*')
          .eq('nisn', email) // email di sini menampung nisn murni jika tidak ada @
          .eq('tanggal_lahir', password)
          .maybeSingle();

        if (siswaErr || !siswaData) {
          Alert.alert('Login Gagal', 'NISN atau Tanggal Lahir salah (Kredensial tidak valid)');
          return;
        }

        // Jika berhasil lewat tabel, simpan ke AsyncStorage manual
        await AsyncStorage.setItem('user_siswa', JSON.stringify(siswaData));
        router.replace('/(tabs)/dashboard');
        return;
      }

      // Jika berhasil lewat Supabase Auth, cek apakah dia siswa
      const { data: siswaData } = await supabase
        .from('data_siswa')
        .select('*')
        .eq('email', formattedEmail)
        .maybeSingle();

      if (siswaData) {
        await AsyncStorage.setItem('user_siswa', JSON.stringify(siswaData));
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Akses Ditolak', 'Akun ini bukan akun Siswa.');
        await supabase.auth.signOut();
      }
    } catch (error: any) {
      Alert.alert('Login Gagal', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Portal Siswa</Text>
          <Text style={styles.subtitle}>Silakan masuk ke akun Anda</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email / NISN</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan email..."
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Tanggal Lahir (Password)</Text>
          <TouchableOpacity 
            style={styles.input} 
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: password ? '#1f2937' : '#9ca3af', fontSize: 16 }}>
              {password ? password : "Pilih Tanggal Lahir (YYYY-MM-DD)"}
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6', // gray-100
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
    color: '#1f2937', // gray-800
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280', // gray-500
  },
  form: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  button: {
    backgroundColor: '#4f46e5', // indigo-600
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
