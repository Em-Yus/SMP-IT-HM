import { Tabs } from 'expo-router';
import { Home, CalendarDays, Wallet, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#85c226', // Hijau SMP IT HM
        tabBarInactiveTintColor: '#9ca3af', // gray-400
        tabBarStyle: {
          paddingBottom: insets.bottom + 5,
          height: 60 + insets.bottom,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="presensi"
        options={{
          title: 'Presensi',
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tagihan"
        options={{
          title: 'Tagihan',
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="jadwal"
        options={{
          href: null,
          title: 'Jadwal',
        }}
      />
      <Tabs.Screen
        name="nilai"
        options={{
          href: null,
          title: 'Nilai Akademik',
        }}
      />
      <Tabs.Screen
        name="mengaji"
        options={{
          href: null,
          title: 'Kelas Mengaji',
        }}
      />
      <Tabs.Screen
        name="prestasi"
        options={{
          href: null,
          title: 'Prestasi & Ekskul',
        }}
      />
      <Tabs.Screen
        name="rapor"
        options={{
          href: null,
          title: 'Rapor Akademik',
        }}
      />
      <Tabs.Screen
        name="pengumuman"
        options={{
          href: null,
          title: 'Pengumuman',
        }}
      />
      <Tabs.Screen
        name="ekskul"
        options={{
          href: null,
          title: 'Ekstrakurikuler',
        }}
      />
    </Tabs>
  );
}
