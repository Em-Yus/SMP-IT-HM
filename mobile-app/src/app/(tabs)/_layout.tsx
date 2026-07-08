import { Tabs } from 'expo-router';
import { Home, CalendarDays, Wallet, User } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#4f46e5', // indigo-600
        tabBarInactiveTintColor: '#9ca3af', // gray-400
        tabBarStyle: {
          paddingBottom: 5,
          height: 60,
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
        name="jadwal"
        options={{
          title: 'Jadwal',
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
        name="nilai"
        options={{
          href: null,
          title: 'Nilai Akademik',
        }}
      />
      <Tabs.Screen
        name="presensi"
        options={{
          href: null,
          title: 'Presensi',
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
    </Tabs>
  );
}
