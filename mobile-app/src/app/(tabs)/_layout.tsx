import { Tabs } from 'expo-router';
import { Home, CalendarDays, Wallet, User, LayoutGrid } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Pressable } from 'react-native';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1E257F',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f3f4f6',
          height: 65 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="presensi"
        options={{
          title: 'Presensi',
          tabBarIcon: ({ color }) => <CalendarDays color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarButton: ({ children, style, onPress, onLongPress, accessibilityState }: any) => (
            <Pressable
              onPress={onPress}
              onLongPress={onLongPress}
              style={style}
              android_ripple={{
                radius: 36,
                borderless: true,
                color: 'rgba(133, 194, 38, 0.4)',
              }}
            >
              {children}
            </Pressable>
          ),
          tabBarIcon: () => (
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#85c226',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: -40,
              shadowColor: '#85c226',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
              elevation: 8,
              borderWidth: 4,
              borderColor: '#ffffff',
            }}>
              <LayoutGrid size={28} color="#ffffff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="tagihan"
        options={{
          title: 'Tagihan',
          tabBarIcon: ({ color }) => <Wallet color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
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
