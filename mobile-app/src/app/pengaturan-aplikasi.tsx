import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { ArrowLeft, Moon, Globe, HardDrive, RefreshCw, Info, Cloud, Settings, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function PengaturanAplikasi() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAutoSync, setIsAutoSync] = useState(true);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2a2c87', '#3b3e9e']}
        style={styles.header}
      >
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengaturan Aplikasi</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Tampilan */}
        <Text style={styles.sectionTitle}>TAMPILAN & BAHASA</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#eef2ff' }]}>
                <Moon size={20} color="#4f46e5" />
              </View>
              <View>
                <Text style={styles.menuItemText}>Mode Gelap</Text>
                <Text style={styles.menuSubtitle}>Gunakan tema gelap untuk aplikasi</Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={setIsDarkMode}
              trackColor={{ false: "#d1d5db", true: "#a5b4fc" }}
              thumbColor={isDarkMode ? "#4f46e5" : "#f3f4f6"}
            />
          </View>
          
          <View style={styles.divider} />
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#ecfdf5' }]}>
                <Globe size={20} color="#10b981" />
              </View>
              <View>
                <Text style={styles.menuItemText}>Bahasa</Text>
                <Text style={styles.menuSubtitle}>Bahasa Indonesia</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Sistem & Sinkronisasi */}
        <Text style={styles.sectionTitle}>SISTEM & SINKRONISASI</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#eff6ff' }]}>
                <Cloud size={20} color="#3b82f6" />
              </View>
              <View>
                <Text style={styles.menuItemText}>Sinkronisasi Otomatis</Text>
                <Text style={styles.menuSubtitle}>Perbarui data di latar belakang</Text>
              </View>
            </View>
            <Switch
              value={isAutoSync}
              onValueChange={setIsAutoSync}
              trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
              thumbColor={isAutoSync ? "#3b82f6" : "#f3f4f6"}
            />
          </View>
          
          <View style={styles.divider} />
          
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Sinkronisasi', 'Data berhasil disinkronkan.')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#f5f3ff' }]}>
                <RefreshCw size={20} color="#8b5cf6" />
              </View>
              <Text style={styles.menuItemText}>Sinkronkan Data Sekarang</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Informasi Sistem */}
        <Text style={styles.sectionTitle}>INFORMASI SISTEM</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#f3f4f6' }]}>
                <Info size={20} color="#4b5563" />
              </View>
              <View>
                <Text style={styles.menuItemText}>Versi Aplikasi</Text>
                <Text style={styles.menuSubtitle}>SIAKAD Mobile v1.46.65 (Revisi ke-6 Hari Ini)</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Pembaruan', 'Aplikasi Anda sudah versi terbaru.')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#fef2f2' }]}>
                <HardDrive size={20} color="#ef4444" />
              </View>
              <Text style={styles.menuItemText}>Periksa Pembaruan</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBack: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
    marginLeft: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  menuGroup: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 66,
  },
});
