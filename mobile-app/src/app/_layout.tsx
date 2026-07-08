import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../../services/supabaseClient';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log('Memulai inisialisasi Supabase...');
    
    // Fallback darurat jika Supabase nyangkut (timeout 3 detik)
    const fallbackTimeout = setTimeout(() => {
      console.log('Supabase nyangkut! Memaksa lanjut ke halaman...');
      setIsInitialized(true);
      SplashScreen.hideAsync();
    }, 3000);

    // Mengecek sesi login awal
    const checkSession = async () => {
      try {
        const localUser = await AsyncStorage.getItem('user_siswa');
        const { data: { session: authSession } } = await supabase.auth.getSession();
        
        clearTimeout(fallbackTimeout);
        
        if (localUser || authSession) {
          console.log('Sesi ditemukan!');
          setSession(localUser ? JSON.parse(localUser) : authSession);
        } else {
          console.log('Tidak ada sesi.');
        }
        
        setIsInitialized(true);
        SplashScreen.hideAsync();
      } catch (err) {
        clearTimeout(fallbackTimeout);
        console.error('Gagal mengambil sesi:', err);
        setIsInitialized(true);
        SplashScreen.hideAsync();
      }
    };
    checkSession();

    // Mendengarkan perubahan status login (jika user login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const performRouting = async () => {
      // Logika pengalihan halaman otomatis (Redirect logic)
      const inTabsGroup = segments[0] === '(tabs)';
      
      const localUser = await AsyncStorage.getItem('user_siswa');
      const hasSession = session || localUser;
      
      if (hasSession && !inTabsGroup) {
        // Jika user sudah login, tapi bukan di area tabs, arahkan ke dashboard
        router.replace('/(tabs)/dashboard');
      } else if (!hasSession && inTabsGroup) {
        // Jika user belum login, tapi mencoba mengakses area tabs, arahkan kembali ke login
        router.replace('/login');
      }
    };
    
    performRouting();
  }, [session, isInitialized, segments]);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
