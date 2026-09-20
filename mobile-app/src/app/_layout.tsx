import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../../services/supabaseClient';
import { View, ActivityIndicator, TouchableOpacity, DeviceEventEmitter, Alert, Animated, Easing, ToastAndroid, Platform } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { 
  initNotificationChannel, 
  configureForegroundNotificationHandler, 
  scheduleGuruReminders, 
  scheduleSiswaReminders,
  PENGUMUMAN_CHANNEL_ID 
} from '../services/scheduleNotificationHelper';

// Cegah splash screen hilang otomatis sebelum aplikasi siap
SplashScreen.preventAutoHideAsync().catch(() => {});

// Konfigurasi notifikasi foreground
configureForegroundNotificationHandler();

type AppSession = {
  hasSession: boolean;
  isGuru: boolean;
};

export default function RootLayout() {
  const [session, setSession] = useState<AppSession | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    
    // Fallback darurat jika Supabase nyangkut (timeout 3.5 detik)
    const fallbackTimeout = setTimeout(() => {
      if (isMounted) {
        setIsInitialized(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    }, 3500);

    // Mengecek sesi login awal
    const checkSession = async () => {
      try {
        const localUserSiswa = await AsyncStorage.getItem('user_siswa');
        const localUserGuru = await AsyncStorage.getItem('user_guru');
        const { data: { session: authSession } } = await supabase.auth.getSession();
        
        clearTimeout(fallbackTimeout);
        
        if (!isMounted) return;

        let validGuru = !!localUserGuru;
        if (localUserGuru) {
          try {
            const u = JSON.parse(localUserGuru);
            if (u?.id) {
              const { data: gCheck } = await supabase.from('data_guru').select('tanggal_keluar').eq('id', u.id).maybeSingle();
              if (gCheck && gCheck.tanggal_keluar) {
                await AsyncStorage.removeItem('user_guru');
                validGuru = false;
              }
            }
          } catch (e) {}
        }

        if (localUserSiswa || validGuru || authSession) {
          setSession({ hasSession: true, isGuru: validGuru });
          
          // Jadwalkan pengingat KBM & Istirahat secara otomatis
          if (validGuru && localUserGuru) {
            try {
              const u = JSON.parse(localUserGuru);
              if (u?.id) scheduleGuruReminders(u.id);
            } catch (e) {}
          } else if (localUserSiswa) {
            try {
              const s = JSON.parse(localUserSiswa);
              if (s?.kelas) {
                supabase.from('data_kelas').select('id').eq('nama_kelas', s.kelas).maybeSingle().then(({ data }) => {
                  if (data?.id) scheduleSiswaReminders(data.id);
                });
              }
            } catch (e) {}
          }
        } else {
          setSession({ hasSession: false, isGuru: false });
        }
        
        setIsInitialized(true);
        SplashScreen.hideAsync().catch(() => {});
      } catch (err) {
        clearTimeout(fallbackTimeout);
        console.error('Gagal mengambil sesi:', err);
        if (isMounted) {
          setIsInitialized(true);
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    };

    initNotificationChannel();
    const notifSub = Notifications.addNotificationResponseReceivedListener(response => {
      const route = response.notification.request.content.data?.route;
      if (route) {
        try {
          router.push(route as any);
        } catch (e) {}
      }
    });
    
    checkSession();

    // Mendengarkan perubahan status auth Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (!isMounted) return;
      if (authSession) {
        setSession({ hasSession: true, isGuru: false });
      }
    });

    // Realtime listener untuk tabel cms_pengumuman (Munculkan notif langsung & refresh data saat app terbuka)
    const pengumumanChannel = supabase
      .channel('public:cms_pengumuman')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cms_pengumuman' },
        async (payload) => {
          const newRow: any = payload.new;
          if (!newRow || newRow.status !== 'Aktif') return;

          // Emit global refresh agar daftar pengumuman langsung ter-update di layar
          DeviceEventEmitter.emit('globalRefresh');

          // Cek kesesuaian target audiens pengguna saat ini
          const localUserSiswa = await AsyncStorage.getItem('user_siswa');
          const localUserGuru = await AsyncStorage.getItem('user_guru');
          const isGuru = !!localUserGuru;
          const isSiswa = !!localUserSiswa && !isGuru;

          const matchTarget =
            newRow.target === 'Semua' ||
            (newRow.target === 'Guru' && isGuru) ||
            (newRow.target === 'Siswa' && isSiswa);

          if (matchTarget) {
            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: '📢 ' + newRow.judul,
                  body: newRow.isi && newRow.isi.length > 120 ? newRow.isi.substring(0, 120) + '...' : newRow.isi,
                  sound: 'default',
                  priority: Notifications.AndroidNotificationPriority.MAX,
                  data: {
                    route: isGuru ? '/pengumuman' : '/(tabs)/pengumuman',
                    type: 'pengumuman',
                  },
                },
                trigger: {
                  channelId: PENGUMUMAN_CHANNEL_ID,
                } as any,
              });
            } catch (err) {
              console.warn('Gagal memicu notifikasi realtime foreground:', err);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cms_pengumuman' },
        () => {
          DeviceEventEmitter.emit('globalRefresh');
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
      notifSub.remove();
      supabase.removeChannel(pengumumanChannel);
    };
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    // Cek update OTA secara otomatis di background setelah aplikasi siap
    const checkBackgroundUpdate = async () => {
      try {
        if (!Updates.isEnabled) return;
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            'Pembaruan Aplikasi',
            'Versi pembaruan baru telah selesai diunduh. Mulai ulang aplikasi sekarang untuk menerapkan fitur terbaru?',
            [
              { text: 'Nanti', style: 'cancel' },
              { text: 'Mulai Ulang', onPress: () => Updates.reloadAsync().catch(() => {}) }
            ]
          );
        }
      } catch (e) {
        // Diamkan jika offline atau gagal koneksi ke server Expo
      }
    };

    const timer = setTimeout(checkBackgroundUpdate, 2500);

    const performRouting = async () => {
      try {
        const currentSegment = segments[0] || 'index';
        const publicRoutes = ['login', 'index', 'pendaftaran', 'pendaftaran-guru'];
        const isPublicRoute = publicRoutes.includes(currentSegment);
        
        const localUserSiswa = await AsyncStorage.getItem('user_siswa');
        const localUserGuru = await AsyncStorage.getItem('user_guru');
        
        const hasSiswaSession = !!localUserSiswa;
        const hasGuruSession = !!localUserGuru;

        if ((hasSiswaSession || hasGuruSession) && isPublicRoute) {
          if (hasGuruSession) {
            router.replace('/(guru-tabs)/dashboard');
          } else {
            router.replace('/(tabs)/dashboard');
          }
        } else if (!hasSiswaSession && !hasGuruSession && !isPublicRoute) {
          router.replace('/login');
        }
      } catch (e) {
        console.warn('Routing check error:', e);
      }
    };
    
    performRouting();

    return () => clearTimeout(timer);
  }, [session, isInitialized, segments]);

  const spinValue = useRef(new Animated.Value(0)).current;

  const handleGlobalRefresh = async () => {
    // Beri tanda visual (animasi putar)
    spinValue.setValue(0);
    Animated.timing(spinValue, {
      toValue: 1,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    if (Platform.OS === 'android') {
      ToastAndroid.show('Memperbarui data & mengecek update...', ToastAndroid.SHORT);
    }

    // 1. Sinkronisasi Data (Kirim event ke seluruh halaman)
    DeviceEventEmitter.emit('globalRefresh');
    
    // 2. Cek update aplikasi OTA secara aman
    try {
      if (!Updates.isEnabled) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Data berhasil diperbarui', ToastAndroid.SHORT);
        }
        return;
      }

      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Mengunduh pembaruan...', ToastAndroid.SHORT);
        }
        await Updates.fetchUpdateAsync();
        Alert.alert(
          'Pembaruan Tersedia', 
          'Pembaruan aplikasi telah selesai diunduh. Mulai ulang sekarang untuk menerapkan pembaruan?',
          [
            { text: 'Nanti', style: 'cancel' },
            { text: 'Mulai Ulang', onPress: () => Updates.reloadAsync().catch(() => {}) }
          ]
        );
      } else {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Aplikasi sudah versi terbaru & data terupdate', ToastAndroid.SHORT);
        }
      }
    } catch (e: any) {
      console.warn('Error checking OTA update:', e);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Data berhasil diperbarui', ToastAndroid.SHORT);
      }
    }
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#2a2c87" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(guru-tabs)" />
      </Stack>
      
      {/* Tombol Refresh Global */}
      <TouchableOpacity 
        style={{
          position: 'absolute',
          top: 45, 
          right: 16,
          backgroundColor: '#ffffff',
          borderRadius: 24,
          padding: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
          zIndex: 9999,
          borderWidth: 1,
          borderColor: '#f3f4f6'
        }}
        onPress={handleGlobalRefresh}
        activeOpacity={0.7}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <RefreshCw size={20} color="#4b5563" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}
