import { Tabs } from 'expo-router';
import { Home, CalendarDays, ClipboardCheck, UserCircle, Clock, LayoutGrid } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Pressable } from 'react-native';

export default function GuruTabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2a2c87', // Biru Laut
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
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jadwal"
        options={{
          title: 'Jadwal',
          tabBarIcon: ({ color }) => <CalendarDays size={24} color={color} />,
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
                color: 'rgba(30, 37, 127, 0.3)',
              }}
            >
              {children}
            </Pressable>
          ),
          tabBarIcon: () => (
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#1E257F',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: -40,
              shadowColor: '#1E257F',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
              elevation: 8,
              borderWidth: 4,
              borderColor: '#ffffff',
            }}>
              <LayoutGrid size={36} color="#ffffff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="presensi"
        options={{
          title: 'Presensi',
          tabBarIcon: ({ color }) => <ClipboardCheck size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Akun',
          tabBarIcon: ({ color }) => <UserCircle size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="master_jam"
        options={{
          href: null,
          title: 'Jam',
          tabBarIcon: ({ color }) => <Clock size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
