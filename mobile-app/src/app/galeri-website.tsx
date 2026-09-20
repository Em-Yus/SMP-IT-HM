import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Image, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { ChevronLeft, Folder, Calendar, Trash2, Upload, RefreshCw, Image as ImageIcon, Camera } from 'lucide-react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

export default function GaleriWebsite() {
  const [albums, setAlbums] = useState<Record<string, { date: string, images: any[] }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [albumNameInput, setAlbumNameInput] = useState('');
  const [albumDateInput, setAlbumDateInput] = useState(new Date().toISOString().split('T')[0]);

  const fetchGaleri = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('cms_galeri').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      const grouped: any = {};
      (data || []).forEach(item => {
         const album = item.album_name || 'Kegiatan Umum';
         if (!grouped[album]) {
            grouped[album] = {
               date: item.album_date || item.created_at.split('T')[0],
               images: []
            };
         }
         grouped[album].images.push(item);
      });
      
      setAlbums(grouped);
    } catch (err) {
      Alert.alert('Error', 'Gagal memuat data galeri');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGaleri();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\galeri-website.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchGaleri();
  
    });

    return () => listener.remove();
  }, []);

  const handlePickAndUpload = async () => {
    if (!albumNameInput.trim()) {
      Alert.alert('Perhatian', 'Ketikkan Nama Kegiatan / Album terlebih dahulu.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Ditolak', 'Dibutuhkan izin galeri untuk mengunggah foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = result.assets.map(async (asset) => {
        const fileExt = asset.uri.split('.').pop() || 'jpg';
        const fileName = `galeri_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `galeri/${fileName}`;

        // React Native way to get blob for Supabase storage
        const response = await fetch(asset.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage.from('berkas_ppdb').upload(filePath, blob, {
           contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`
        });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('berkas_ppdb').getPublicUrl(filePath);
        return urlData.publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      const dbPayload = uploadedUrls.map(url => ({ 
         url: url,
         album_name: albumNameInput.trim(),
         album_date: albumDateInput || new Date().toISOString().split('T')[0]
      }));

      const { error: dbError } = await supabase.from('cms_galeri').insert(dbPayload);
      if (dbError) throw dbError;

      Alert.alert('Berhasil', `${uploadedUrls.length} foto berhasil ditambahkan ke album "${albumNameInput}".`);
      setAlbumNameInput('');
      setAlbumDateInput(new Date().toISOString().split('T')[0]);
      fetchGaleri();
    } catch (err: any) {
      Alert.alert('Gagal Mengunggah', err.message || 'Terjadi kesalahan.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!albumNameInput.trim()) {
      Alert.alert('Perhatian', 'Ketikkan Nama Kegiatan / Album terlebih dahulu.');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Ditolak', 'Dibutuhkan izin kamera untuk mengambil foto.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    setIsUploading(true);
    try {
      const asset = result.assets[0];
      const fileExt = asset.uri.split('.').pop() || 'jpg';
      const fileName = `galeri_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `galeri/${fileName}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage.from('berkas_ppdb').upload(filePath, blob, {
         contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`
      });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('berkas_ppdb').getPublicUrl(filePath);
      
      const dbPayload = [{ 
         url: urlData.publicUrl,
         album_name: albumNameInput.trim(),
         album_date: albumDateInput || new Date().toISOString().split('T')[0]
      }];

      const { error: dbError } = await supabase.from('cms_galeri').insert(dbPayload);
      if (dbError) throw dbError;

      Alert.alert('Berhasil', `1 foto baru ditambahkan ke album "${albumNameInput}".`);
      setAlbumNameInput('');
      setAlbumDateInput(new Date().toISOString().split('T')[0]);
      fetchGaleri();
    } catch (err: any) {
      Alert.alert('Gagal Mengambil Foto', err.message || 'Terjadi kesalahan.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Hapus Foto?', 'Foto ini akan dihapus dari sistem.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
          setIsLoading(true);
          try {
            await supabase.from('cms_galeri').delete().eq('id', id);
            fetchGaleri();
          } catch (err) {
            Alert.alert('Error', 'Gagal menghapus foto.');
            setIsLoading(false);
          }
        }
      }
    ]);
  };

  const handleDeleteAlbum = (albumName: string, albumImages: any[]) => {
    Alert.alert(`Hapus Album "${albumName}"?`, `Ini akan menghapus seluruh ${albumImages.length} foto di dalamnya.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus Semua', style: 'destructive', onPress: async () => {
          setIsLoading(true);
          try {
            const idsToDelete = albumImages.map(img => img.id);
            await supabase.from('cms_galeri').delete().in('id', idsToDelete);
            fetchGaleri();
          } catch (err) {
            Alert.alert('Error', 'Gagal menghapus album.');
            setIsLoading(false);
          }
        }
      }
    ]);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
       const date = new Date(dateString);
       return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
       return dateString;
    }
  };

  const albumKeys = Object.keys(albums).sort((a, b) => new Date(albums[b].date).getTime() - new Date(albums[a].date).getTime());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Galeri Website</Text>
        </View>
        <Text style={styles.headerSubtitle}>CMS Pengaturan Galeri Kegiatan Sekolah</Text>
      </View>

      <View style={styles.uploadSection}>
        <Text style={styles.sectionTitle}>Tambah Album / Foto Baru</Text>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Nama Kegiatan / Album *</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Cth: Perkemahan Jumat Sabtu" 
            value={albumNameInput} 
            onChangeText={setAlbumNameInput} 
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Tanggal Pelaksanaan</Text>
          <TextInput 
            style={styles.input} 
            placeholder="YYYY-MM-DD" 
            value={albumDateInput} 
            onChangeText={setAlbumDateInput} 
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity style={[styles.btnUpload, (!albumNameInput.trim() || isUploading) && styles.btnDisabled, { flex: 1 }]} onPress={handlePickAndUpload} disabled={isUploading || !albumNameInput.trim()}>
            {isUploading ? <ActivityIndicator color="#fff" /> : <><Upload size={20} color="#fff" /><Text style={styles.btnUploadText}>Galeri</Text></>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnCamera, (!albumNameInput.trim() || isUploading) && styles.btnDisabled, { flex: 1 }]} onPress={handleTakePhoto} disabled={isUploading || !albumNameInput.trim()}>
            {isUploading ? <ActivityIndicator color="#fff" /> : <><Camera size={20} color="#fff" /><Text style={styles.btnUploadText}>Kamera</Text></>}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>Daftar Album</Text>
          <TouchableOpacity onPress={fetchGaleri} style={styles.btnRefresh}>
             <RefreshCw size={16} color="#4b5563" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 40 }} />
        ) : albumKeys.length === 0 ? (
          <View style={styles.emptyState}>
             <Folder size={48} color="#d1d5db" />
             <Text style={styles.emptyText}>Belum ada album kegiatan.</Text>
          </View>
        ) : (
          albumKeys.map((albumName) => (
            <View key={albumName} style={styles.albumCard}>
              <View style={styles.albumHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.albumTitle}>{albumName}</Text>
                  <View style={styles.albumMeta}>
                    <View style={styles.badge}><Text style={styles.badgeText}>{albums[albumName].images.length} Foto</Text></View>
                    <Text style={styles.albumDate}><Calendar size={12} color="#6b7280" /> {formatDate(albums[albumName].date)}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.btnDeleteAlbum} onPress={() => handleDeleteAlbum(albumName, albums[albumName].images)}>
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.imageGrid}>
                {albums[albumName].images.map(img => (
                  <View key={img.id} style={styles.imageWrapper}>
                    <Image source={{ uri: img.url }} style={styles.image} />
                    <TouchableOpacity style={styles.btnDeleteImage} onPress={() => handleDelete(img.id)}>
                      <Trash2 size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { backgroundColor: '#2a2c87', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { color: '#e0e7ff', fontSize: 13 },
  
  uploadSection: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },
  formGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#4b5563', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14 },
  
  btnUpload: { backgroundColor: '#85c226', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  btnCamera: { backgroundColor: '#2a2c87', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  btnUploadText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnDisabled: { backgroundColor: '#9ca3af' },

  content: { flex: 1, padding: 16 },
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  btnRefresh: { padding: 8, backgroundColor: '#e5e7eb', borderRadius: 8 },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, backgroundColor: '#fff', borderRadius: 16 },
  emptyText: { color: '#9ca3af', marginTop: 12, fontStyle: 'italic' },
  
  albumCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  albumHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 12, marginBottom: 12 },
  albumTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 6 },
  albumMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: 'bold', color: '#4b5563' },
  albumDate: { fontSize: 12, color: '#6b7280', flexDirection: 'row', alignItems: 'center' },
  
  btnDeleteAlbum: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 8 },

  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageWrapper: { width: '31%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  btnDeleteImage: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 6, borderRadius: 20 },
});
