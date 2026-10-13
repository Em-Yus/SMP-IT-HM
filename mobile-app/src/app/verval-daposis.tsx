import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  ToastAndroid,
  DeviceEventEmitter,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  RefreshCw,
  UserPlus,
  ShieldCheck,
  Copy,
  Save,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Database,
  X,
  Check,
  FileUp,
} from 'lucide-react-native';
import { supabase } from '../../services/supabaseClient';
import {
  FIELD_DEFINITIONS,
  autoMatchColumns,
  compareAndMergeStudentDatabases,
  compareFieldValues,
  normalizeDate,
  normalizeGender,
  StudentValidationResult,
} from '../utils/vervalComparator';
import { Picker } from '@react-native-picker/picker';

export default function VerValDapoSisScreen() {
  // State Data SIAKAD
  const [dataSiswa, setDataSiswa] = useState<any[]>([]);
  const [loadingSiswa, setLoadingSiswa] = useState(true);

  // State File Dapodik
  const [dapodikFile, setDapodikFile] = useState<{
    name: string;
    size: string;
    rowsCount: number;
  } | null>(null);
  const [dapodikRows, setDapodikRows] = useState<any[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isParsingFile, setIsParsingFile] = useState(false);

  // Filter & Search
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'invalid'>('invalid');
  const [filterSource, setFilterSource] = useState<'all' | 'both' | 'only_siakad' | 'only_dapodik'>('all');
  const [filterKelas, setFilterKelas] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'status' | 'name' | 'nisn'>('status');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [isSideBySideModalOpen, setIsSideBySideModalOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  // Form State untuk Modal Perbaikan
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch data_siswa aktif dari Supabase
  const fetchSiswa = async () => {
    setLoadingSiswa(true);
    try {
      const { data, error } = await supabase
        .from('data_siswa')
        .select('*')
        .eq('status_keaktifan', 'Aktif')
        .neq('kelas', 'Calon Siswa')
        .order('nama', { ascending: true });

      if (error) throw error;
      setDataSiswa(data || []);
    } catch (err: any) {
      console.error('Error fetching data siswa:', err);
      Alert.alert('Gagal', err.message || 'Gagal memuat data siswa.');
    } finally {
      setLoadingSiswa(false);
    }
  };

  useEffect(() => {
    fetchSiswa();

    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      fetchSiswa();
    });
    return () => listener.remove();
  }, []);

  // 2. Eksekusi Komparasi & Merge (Full Outer Join)
  const validationResults = useMemo(() => {
    return compareAndMergeStudentDatabases(dataSiswa, dapodikRows, columnMapping, FIELD_DEFINITIONS);
  }, [dataSiswa, dapodikRows, columnMapping]);

  // 3. Ringkasan Counter Statistik
  const summary = useMemo(() => {
    const totalSiswa = validationResults.length;
    let totalValid = 0;
    let totalInvalid = 0;
    let totalBoth = 0;
    let totalOnlySiakad = 0;
    let totalOnlyDapodik = 0;

    validationResults.forEach(item => {
      if (item.isValid) totalValid += 1;
      else totalInvalid += 1;

      if (item.sourceType === 'both') totalBoth += 1;
      else if (item.sourceType === 'only_siakad') totalOnlySiakad += 1;
      else if (item.sourceType === 'only_dapodik') totalOnlyDapodik += 1;
    });

    const validPercentage = totalSiswa > 0 ? Math.round((totalValid / totalSiswa) * 100) : 0;

    return {
      totalSiswa,
      totalValid,
      totalInvalid,
      totalBoth,
      totalOnlySiakad,
      totalOnlyDapodik,
      validPercentage,
    };
  }, [validationResults]);

  // 4. Daftar Opsi Kelas Unik
  const availableClasses = useMemo(() => {
    const classes = new Set<string>();
    validationResults.forEach(item => {
      if (item.displayKelas) classes.add(item.displayKelas);
    });
    return Array.from(classes).sort();
  }, [validationResults]);

  // 5. Filter & Sort Hasil
  const filteredAndSortedList = useMemo(() => {
    let result = [...validationResults];

    if (filterStatus === 'valid') {
      result = result.filter(item => item.isValid);
    } else if (filterStatus === 'invalid') {
      result = result.filter(item => !item.isValid);
    }

    if (filterSource !== 'all') {
      result = result.filter(item => item.sourceType === filterSource);
    }

    if (filterKelas !== 'all') {
      result = result.filter(item => item.displayKelas === filterKelas);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(item => {
        const nama = (item.displayName || '').toLowerCase();
        const nisn = (item.displayNisn || '').toLowerCase();
        const nik = (item.siswa?.nik || item.dapodikRow?.[columnMapping.nik] || '').toString().toLowerCase();
        return nama.includes(q) || nisn.includes(q) || nik.includes(q);
      });
    }

    result.sort((a, b) => {
      if (sortBy === 'status') {
        const aVal = a.isValid ? 1 : 0;
        const bVal = b.isValid ? 1 : 0;
        if (sortOrder === 'asc') {
          if (aVal !== bVal) return aVal - bVal;
        } else {
          if (aVal !== bVal) return bVal - aVal;
        }
        if (a.sourceType !== b.sourceType) {
          const typeWeight = { only_dapodik: 0, only_siakad: 1, both: 2 };
          return (typeWeight[a.sourceType] ?? 3) - (typeWeight[b.sourceType] ?? 3);
        }
        return (a.displayName || '').localeCompare(b.displayName || '');
      }

      if (sortBy === 'name') {
        const cmp = (a.displayName || '').localeCompare(b.displayName || '');
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      if (sortBy === 'nisn') {
        const cmp = (a.displayNisn || '').localeCompare(b.displayNisn || '');
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      return 0;
    });

    return result;
  }, [validationResults, filterStatus, filterSource, filterKelas, searchQuery, sortBy, sortOrder, columnMapping]);

  // 6. Picker Dokumen Excel / CSV
  const handlePickDocument = async () => {
    try {
      setIsParsingFile(true);
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setIsParsingFile(false);
        return;
      }

      const picked = res.assets[0];
      const b64 = await FileSystem.readAsStringAsync(picked.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const wb = XLSX.read(b64, { type: 'base64' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

      if (!rawJson || rawJson.length === 0) {
        throw new Error('File tidak memiliki baris data.');
      }

      const firstRow = (rawJson[0] || {}) as Record<string, any>;
      const headers = Object.keys(firstRow);
      setDetectedHeaders(headers);
      setDapodikRows(rawJson as any[]);
      setDapodikFile({
        name: picked.name,
        size: ((picked.size || 0) / 1024).toFixed(1) + ' KB',
        rowsCount: rawJson.length,
      });

      const autoMap = autoMatchColumns(headers, FIELD_DEFINITIONS);
      setColumnMapping(autoMap);
      setIsMappingModalOpen(true);

      if (Platform.OS === 'android') {
        ToastAndroid.show(`Terbaca ${rawJson.length} baris data Dapodik`, ToastAndroid.SHORT);
      }
    } catch (err: any) {
      console.error('Error pick document:', err);
      Alert.alert('Gagal Membaca File', err.message || 'File Excel/CSV tidak dapat diproses.');
    } finally {
      setIsParsingFile(false);
    }
  };

  // 7. Modal Perbaikan Handlers
  const activeValidationItem = activeItemIndex !== null ? filteredAndSortedList[activeItemIndex] : null;

  const openValidationModal = (index: number) => {
    setActiveItemIndex(index);
    const item = filteredAndSortedList[index];
    if (!item) return;

    const initial: Record<string, string> = {};
    if (item.sourceType === 'only_dapodik') {
      FIELD_DEFINITIONS.forEach(def => {
        const rawDap = columnMapping[def.key] ? item.dapodikRow?.[columnMapping[def.key]] : '';
        let val = rawDap !== undefined && rawDap !== null ? String(rawDap).trim() : '';
        if (def.type === 'date') val = normalizeDate(val) || val;
        else if (def.type === 'gender') {
          const g = normalizeGender(val);
          if (g === 'L') val = 'Laki-laki';
          else if (g === 'P') val = 'Perempuan';
        }
        initial[def.key] = val;
      });
    } else if (item.siswa) {
      FIELD_DEFINITIONS.forEach(def => {
        initial[def.key] = item.siswa[def.key] !== null && item.siswa[def.key] !== undefined ? String(item.siswa[def.key]) : '';
      });
    }

    setFormData(initial);
    setIsSideBySideModalOpen(true);
  };

  const handleCopyAllFromDapodik = () => {
    if (!activeValidationItem?.dapodikRow) return;
    const updated = { ...formData };
    FIELD_DEFINITIONS.forEach(def => {
      const header = columnMapping[def.key];
      if (header && activeValidationItem.dapodikRow[header] !== undefined) {
        let val = String(activeValidationItem.dapodikRow[header]).trim();
        if (def.type === 'date') val = normalizeDate(val) || val;
        else if (def.type === 'gender') {
          const g = normalizeGender(val);
          if (g === 'L') val = 'Laki-laki';
          else if (g === 'P') val = 'Perempuan';
        }
        updated[def.key] = val;
      }
    });
    setFormData(updated);

    if (Platform.OS === 'android') {
      ToastAndroid.show('Semua nilai acuan Dapodik telah disalin', ToastAndroid.SHORT);
    } else {
      Alert.alert('Berhasil', 'Semua nilai Dapodik telah disalin ke formulir.');
    }
  };

  const handleSaveModal = async () => {
    if (!activeValidationItem) return;
    setIsSaving(true);
    try {
      const payload: Record<string, any> = {};
      FIELD_DEFINITIONS.forEach(def => {
        const val = formData[def.key];
        payload[def.key] = val !== undefined && val !== '' ? val : null;
      });

      if (activeValidationItem.sourceType === 'only_dapodik') {
        payload.status_keaktifan = 'Aktif';
        payload.status_siswa = 'Baru';

        const { data, error } = await supabase.from('data_siswa').insert([payload]).select().single();
        if (error) throw error;

        setDataSiswa(prev => [...prev, data]);
        Alert.alert('Sukses', `Siswa "${data.nama}" berhasil didaftarkan ke database SIAKAD.`);
      } else if (activeValidationItem.siswa) {
        const { data, error } = await supabase
          .from('data_siswa')
          .update(payload)
          .eq('id', activeValidationItem.siswa.id)
          .select()
          .single();
        if (error) throw error;

        setDataSiswa(prev => prev.map(s => (s.id === data.id ? data : s)));
        Alert.alert('Sukses', `Data siswa "${data.nama}" berhasil diperbarui.`);
      }

      setIsSideBySideModalOpen(false);
    } catch (err: any) {
      console.error('Error saving siswa:', err);
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Gradient */}
      <LinearGradient colors={['#2a2c87', '#3b3e9e']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>VerVal DapoSis</Text>
            <Text style={styles.headerSubtitle}>Validasi SIAKAD vs Dapodik</Text>
          </View>
          <TouchableOpacity onPress={fetchSiswa} style={styles.refreshButton}>
            <RefreshCw color="#fff" size={20} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* 2. File Upload Banner */}
      <View style={styles.uploadBanner}>
        {!dapodikFile ? (
          <TouchableOpacity
            style={styles.uploadBox}
            onPress={handlePickDocument}
            disabled={isParsingFile}
            activeOpacity={0.8}
          >
            <Upload color="#2a2c87" size={28} />
            <Text style={styles.uploadTitle}>
              {isParsingFile ? 'Sedang Membaca File...' : 'Pilih Berkas Ekspor Dapodik (.xlsx / .csv)'}
            </Text>
            <Text style={styles.uploadSubtitle}>Klik untuk memilih file hasil unduhan Dapodik dari HP Anda</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.fileActiveBox}>
            <View style={styles.fileActiveRow}>
              <View style={styles.fileIconBox}>
                <FileSpreadsheet color="#059669" size={22} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.fileNameText} numberOfLines={1}>
                  {dapodikFile.name}
                </Text>
                <Text style={styles.fileMetaText}>
                  {dapodikFile.rowsCount} Baris Siswa &bull; {dapodikFile.size}
                </Text>
              </View>
            </View>
            <View style={styles.fileActionRow}>
              <TouchableOpacity
                style={styles.btnSmallMapping}
                onPress={() => setIsMappingModalOpen(true)}
              >
                <SlidersHorizontal color="#2a2c87" size={14} />
                <Text style={styles.btnSmallMappingText}>Atur Pemetaan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSmallChange} onPress={handlePickDocument}>
                <Text style={styles.btnSmallChangeText}>Ganti File</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 3. Summary Stats (Horizontal Carousel) */}
      <View style={styles.statsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
          <TouchableOpacity
            style={[styles.statChip, filterStatus === 'all' && filterSource === 'all' && styles.statChipActive]}
            onPress={() => {
              setFilterStatus('all');
              setFilterSource('all');
            }}
          >
            <Text style={styles.statChipLabel}>TOTAL</Text>
            <Text style={styles.statChipVal}>{summary.totalSiswa}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statChip, filterStatus === 'valid' && styles.statChipValidActive]}
            onPress={() => {
              setFilterStatus('valid');
              setFilterSource('all');
            }}
          >
            <View style={styles.rowAlign}>
              <CheckCircle2 color="#059669" size={13} />
              <Text style={[styles.statChipLabel, { color: '#059669', marginLeft: 4 }]}>VALID</Text>
            </View>
            <Text style={[styles.statChipVal, { color: '#059669' }]}>
              {summary.totalValid} ({summary.validPercentage}%)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statChip, filterStatus === 'invalid' && filterSource === 'all' && styles.statChipInvalidActive]}
            onPress={() => {
              setFilterStatus('invalid');
              setFilterSource('all');
            }}
          >
            <View style={styles.rowAlign}>
              <XCircle color="#E11D48" size={13} />
              <Text style={[styles.statChipLabel, { color: '#E11D48', marginLeft: 4 }]}>BELUM VALID</Text>
            </View>
            <Text style={[styles.statChipVal, { color: '#E11D48' }]}>{summary.totalInvalid}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statChip, filterSource === 'only_dapodik' && styles.statChipDapodikActive]}
            onPress={() => {
              setFilterStatus('all');
              setFilterSource('only_dapodik');
            }}
          >
            <View style={styles.rowAlign}>
              <UserPlus color="#2563EB" size={13} />
              <Text style={[styles.statChipLabel, { color: '#2563EB', marginLeft: 4 }]}>HANYA DAPODIK</Text>
            </View>
            <Text style={[styles.statChipVal, { color: '#2563EB' }]}>{summary.totalOnlyDapodik}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statChip, filterSource === 'only_siakad' && styles.statChipSiakadActive]}
            onPress={() => {
              setFilterStatus('all');
              setFilterSource('only_siakad');
            }}
          >
            <View style={styles.rowAlign}>
              <AlertTriangle color="#D97706" size={13} />
              <Text style={[styles.statChipLabel, { color: '#D97706', marginLeft: 4 }]}>HANYA SIAKAD</Text>
            </View>
            <Text style={[styles.statChipVal, { color: '#D97706' }]}>{summary.totalOnlySiakad}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 4. Search & Filter Bar */}
      <View style={styles.toolbarContainer}>
        <View style={styles.searchBox}>
          <Search color="#94A3B8" size={18} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama, NISN, atau NIK..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color="#94A3B8" size={16} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Kelas & Sort */}
        <View style={styles.subFilterRow}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={filterKelas}
              onValueChange={itemValue => setFilterKelas(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Semua Kelas" value="all" />
              {availableClasses.map(k => (
                <Picker.Item key={k} label={`Kelas ${k}`} value={k} />
              ))}
            </Picker>
          </View>

          <TouchableOpacity
            style={styles.sortToggleBtn}
            onPress={() => {
              if (sortBy === 'status') {
                setSortBy('name');
                setSortOrder('asc');
              } else if (sortBy === 'name') {
                setSortBy('nisn');
                setSortOrder('asc');
              } else {
                setSortBy('status');
                setSortOrder('asc');
              }
            }}
          >
            <ArrowUpDown color="#2a2c87" size={14} />
            <Text style={styles.sortToggleText}>
              {sortBy === 'status' ? 'Status' : sortBy === 'name' ? 'Nama' : 'NISN'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 5. Daftar Kartu Siswa */}
      {loadingSiswa ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2a2c87" />
          <Text style={styles.loadingText}>Memuat data siswa...</Text>
        </View>
      ) : filteredAndSortedList.length === 0 ? (
        <View style={styles.centerContainer}>
          <Search color="#CBD5E1" size={48} />
          <Text style={styles.emptyTitle}>Tidak ada data siswa ditemukan</Text>
          <Text style={styles.emptySubtitle}>Coba ubah kata kunci pencarian atau filter status Anda.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAndSortedList}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item, index }) => {
            const isValid = item.isValid;
            const sourceType = item.sourceType;

            let cardBorderColor = '#E11D48'; // Belum valid
            let cardBgColor = '#FFF1F2';
            if (isValid) {
              cardBorderColor = '#059669';
              cardBgColor = '#ECFDF5';
            } else if (sourceType === 'only_dapodik') {
              cardBorderColor = '#2563EB';
              cardBgColor = '#EFF6FF';
            } else if (sourceType === 'only_siakad') {
              cardBorderColor = '#D97706';
              cardBgColor = '#FFFBEB';
            }

            return (
              <View style={[styles.studentCard, { borderLeftColor: cardBorderColor, backgroundColor: cardBgColor }]}>
                {/* Header Kartu */}
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentNameText}>{item.displayName}</Text>
                    <Text style={styles.studentMetaText}>
                      NISN: {item.displayNisn || '-'} &bull; Kelas: {item.displayKelas || '-'}
                    </Text>
                  </View>

                  {/* Badge Sumber / Match */}
                  {item.matchedBy ? (
                    <View style={styles.badgeMatchedBy}>
                      <Text style={styles.badgeMatchedByText}>via {item.matchedBy}</Text>
                    </View>
                  ) : null}
                </View>

                {/* 2 Indikator: Di Dapodik vs Di SIAKAD */}
                <View style={styles.twoIndicatorRow}>
                  {/* Indikator Dapodik */}
                  <View style={styles.indicatorChip}>
                    <Text style={styles.indicatorLabel}>Dapodik:</Text>
                    {item.isMatchedInDapodik ? (
                      <View style={[styles.statusBadge, styles.badgeSuccess]}>
                        <CheckCircle2 color="#059669" size={12} />
                        <Text style={[styles.statusBadgeText, { color: '#059669' }]}>Ada</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, styles.badgeDanger]}>
                        <XCircle color="#E11D48" size={12} />
                        <Text style={[styles.statusBadgeText, { color: '#E11D48' }]}>Tidak</Text>
                      </View>
                    )}
                  </View>

                  {/* Indikator SIAKAD */}
                  <View style={styles.indicatorChip}>
                    <Text style={styles.indicatorLabel}>SIAKAD:</Text>
                    {item.isMatchedInSiakad ? (
                      <View style={[styles.statusBadge, styles.badgeSuccess]}>
                        <CheckCircle2 color="#059669" size={12} />
                        <Text style={[styles.statusBadgeText, { color: '#059669' }]}>Ada</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, styles.badgeDanger]}>
                        <XCircle color="#E11D48" size={12} />
                        <Text style={[styles.statusBadgeText, { color: '#E11D48' }]}>Tidak</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Ringkasan Status Validasi */}
                <View style={styles.statusDescriptionRow}>
                  {isValid ? (
                    <Text style={[styles.statusDescText, { color: '#059669' }]}>
                      ✔ Seluruh data esensial identik antara SIAKAD & Dapodik
                    </Text>
                  ) : sourceType === 'only_dapodik' ? (
                    <Text style={[styles.statusDescText, { color: '#2563EB' }]}>
                      ℹ Siswa baru terdata di Dapodik, belum masuk ke SIAKAD
                    </Text>
                  ) : sourceType === 'only_siakad' ? (
                    <Text style={[styles.statusDescText, { color: '#D97706' }]}>
                      ⚠ Terdaftar di SIAKAD, tidak ditemukan di berkas Dapodik
                    </Text>
                  ) : (
                    <Text style={[styles.statusDescText, { color: '#E11D48' }]}>
                      ✖ {item.mismatchedFieldsCount} field berbeda ({item.mismatchedFieldNames.slice(0, 2).join(', ')}
                      {item.mismatchedFieldNames.length > 2 ? '...' : ''})
                    </Text>
                  )}
                </View>

                {/* Tombol Aksi */}
                <View style={styles.cardActionRow}>
                  {sourceType === 'only_dapodik' ? (
                    <TouchableOpacity
                      style={styles.btnActionDapodik}
                      onPress={() => openValidationModal(index)}
                    >
                      <UserPlus color="#fff" size={15} />
                      <Text style={styles.btnActionDapodikText}>Tambah ke SIAKAD</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.btnActionValidate}
                      onPress={() => openValidationModal(index)}
                    >
                      <ShieldCheck color="#fff" size={15} />
                      <Text style={styles.btnActionValidateText}>Validasi / Edit Data</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* 6. Modal Pemetaan Kolom */}
      <Modal visible={isMappingModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Pemetaan Kolom Dapodik</Text>
                <Text style={styles.modalSubtitle}>Cocokkan kolom tabel SIAKAD dengan header file Dapodik</Text>
              </View>
              <TouchableOpacity onPress={() => setIsMappingModalOpen(false)}>
                <X color="#64748B" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {FIELD_DEFINITIONS.map(field => {
                const selected = columnMapping[field.key] || '';
                return (
                  <View key={field.key} style={styles.mappingFieldRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mappingFieldLabel}>
                        {field.label} {field.isEssential ? <Text style={{ color: '#E11D48' }}>*Wajib</Text> : null}
                      </Text>
                      <Text style={styles.mappingFieldKey}>data_siswa.{field.key}</Text>
                    </View>

                    <View style={styles.mappingPickerBox}>
                      <Picker
                        selectedValue={selected}
                        onValueChange={val => setColumnMapping(prev => ({ ...prev, [field.key]: val }))}
                        style={styles.pickerCompact}
                      >
                        <Picker.Item label="-- Abaikan / Belum Ada --" value="" />
                        {detectedHeaders.map(h => (
                          <Picker.Item key={h} label={h} value={h} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => {
                  const auto = autoMatchColumns(detectedHeaders, FIELD_DEFINITIONS);
                  setColumnMapping(auto);
                }}
              >
                <Sparkles color="#2a2c87" size={16} />
                <Text style={styles.btnSecondaryText}>Auto-Match</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => setIsMappingModalOpen(false)}
              >
                <Check color="#fff" size={16} />
                <Text style={styles.btnPrimaryText}>Selesai & Proses</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. Modal Perbandingan & Perbaikan Langsung */}
      <Modal visible={isSideBySideModalOpen} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentLarge}>
            {/* Header Modal Side-by-Side */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {activeValidationItem?.sourceType === 'only_dapodik'
                    ? 'Daftarkan Siswa dari Dapodik'
                    : 'Validasi & Koreksi Data'}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {activeValidationItem?.displayName} &bull; NISN: {activeValidationItem?.displayNisn || '-'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsSideBySideModalOpen(false)}>
                <X color="#64748B" size={24} />
              </TouchableOpacity>
            </View>

            {/* Quick Action Bar */}
            {activeValidationItem?.dapodikRow ? (
              <View style={styles.quickActionBar}>
                <TouchableOpacity
                  style={styles.btnCopyAll}
                  onPress={handleCopyAllFromDapodik}
                >
                  <Sparkles color="#2a2c87" size={14} />
                  <Text style={styles.btnCopyAllText}>Salin Semua Nilai dari Dapodik</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* List Perbandingan Field */}
            <ScrollView style={{ maxHeight: 380, paddingHorizontal: 4 }}>
              {FIELD_DEFINITIONS.map(field => {
                const dapHeader = columnMapping[field.key];
                const rawDapVal = dapHeader && activeValidationItem?.dapodikRow ? activeValidationItem.dapodikRow[dapHeader] : '';
                const siakadVal = formData[field.key] || '';

                const comp = compareFieldValues(field.key, siakadVal, rawDapVal, field.type);
                const isMatch = comp.isMatch;

                return (
                  <View key={field.key} style={styles.fieldCompareItem}>
                    <View style={styles.fieldHeaderRow}>
                      <Text style={styles.fieldLabelText}>
                        {field.label} {field.isEssential ? <Text style={{ color: '#E11D48' }}>*</Text> : null}
                      </Text>
                      {activeValidationItem?.sourceType === 'only_dapodik' ? (
                        <Text style={styles.badgeNewDapodik}>Data Baru</Text>
                      ) : isMatch ? (
                        <View style={styles.matchBadgeRow}>
                          <CheckCircle2 color="#059669" size={12} />
                          <Text style={{ color: '#059669', fontSize: 11, fontWeight: 'bold', marginLeft: 3 }}>Cocok</Text>
                        </View>
                      ) : (
                        <View style={styles.matchBadgeRow}>
                          <XCircle color="#E11D48" size={12} />
                          <Text style={{ color: '#E11D48', fontSize: 11, fontWeight: 'bold', marginLeft: 3 }}>Berbeda</Text>
                        </View>
                      )}
                    </View>

                    {/* Data Dapodik (Read-only) */}
                    <View style={styles.dapodikValueBox}>
                      <Text style={styles.dapodikValueLabel}>Dapodik (Acuan):</Text>
                      <Text style={styles.dapodikValueText} numberOfLines={1}>
                        {rawDapVal ? String(rawDapVal) : '(Kosong / Tidak ada)'}
                      </Text>
                      {rawDapVal && !isMatch ? (
                        <TouchableOpacity
                          style={styles.btnCopyField}
                          onPress={() => {
                            let target = String(rawDapVal).trim();
                            if (field.type === 'date') target = normalizeDate(target) || target;
                            else if (field.type === 'gender') {
                              const g = normalizeGender(target);
                              if (g === 'L') target = 'Laki-laki';
                              else if (g === 'P') target = 'Perempuan';
                            }
                            setFormData(prev => ({ ...prev, [field.key]: target }));
                          }}
                        >
                          <Copy color="#2a2c87" size={12} />
                          <Text style={styles.btnCopyFieldText}>Salin</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Input SIAKAD (Editable) */}
                    <View style={styles.siakadInputBox}>
                      <Text style={styles.siakadInputLabel}>Nilai di SIAKAD:</Text>
                      <TextInput
                        style={[
                          styles.siakadTextInput,
                          isMatch ? styles.inputMatch : styles.inputMismatch,
                        ]}
                        value={siakadVal}
                        onChangeText={text => setFormData(prev => ({ ...prev, [field.key]: text }))}
                        placeholder={field.placeholder || `Masukkan ${field.label}`}
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Footer Modal Actions */}
            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setIsSideBySideModalOpen(false)}
                disabled={isSaving}
              >
                <Text style={styles.btnSecondaryText}>Tutup</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  activeValidationItem?.sourceType === 'only_dapodik' && { backgroundColor: '#2563EB' },
                ]}
                onPress={handleSaveModal}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Save color="#fff" size={16} />
                    <Text style={styles.btnPrimaryText}>
                      {activeValidationItem?.sourceType === 'only_dapodik' ? 'Daftarkan ke SIAKAD' : 'Simpan Perubahan'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 48 : 36,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  refreshButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  uploadBanner: {
    margin: 12,
    marginBottom: 8,
  },
  uploadBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 8,
    textAlign: 'center',
  },
  uploadSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  fileActiveBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  fileActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  fileMetaText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  fileActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  btnSmallMapping: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  btnSmallMappingText: {
    color: '#2a2c87',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  btnSmallChange: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  btnSmallChangeText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  statsContainer: {
    marginBottom: 8,
  },
  statsScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  statChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 90,
  },
  statChipActive: {
    borderColor: '#2a2c87',
    backgroundColor: '#EEF2FF',
  },
  statChipValidActive: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  statChipInvalidActive: {
    borderColor: '#E11D48',
    backgroundColor: '#FFF1F2',
  },
  statChipDapodikActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  statChipSiakadActive: {
    borderColor: '#D97706',
    backgroundColor: '#FFFBEB',
  },
  statChipLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748B',
  },
  statChipVal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 2,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarContainer: {
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    marginLeft: 8,
  },
  subFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  pickerWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    height: 38,
    fontSize: 12,
  },
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  sortToggleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2a2c87',
    marginLeft: 4,
  },
  listContainer: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  studentCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  studentNameText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  studentMetaText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  badgeMatchedBy: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  badgeMatchedByText: {
    fontSize: 10,
    color: '#4338CA',
    fontWeight: 'bold',
  },
  twoIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  indicatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorLabel: {
    fontSize: 11,
    color: '#64748B',
    marginRight: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeSuccess: {
    backgroundColor: '#ECFDF5',
  },
  badgeDanger: {
    backgroundColor: '#FFF1F2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  statusDescriptionRow: {
    marginTop: 6,
  },
  statusDescText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 8,
  },
  btnActionDapodik: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnActionDapodikText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  btnActionValidate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2c87',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnActionValidateText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContentLarge: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  btnSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E293B',
    marginLeft: 4,
  },
  btnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#2a2c87',
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  mappingFieldRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  mappingFieldLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  mappingFieldKey: {
    fontSize: 11,
    color: '#94A3B8',
  },
  mappingPickerBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 4,
    height: 40,
    justifyContent: 'center',
  },
  pickerCompact: {
    height: 40,
    fontSize: 12,
  },
  quickActionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  btnCopyAll: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  btnCopyAllText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2a2c87',
    marginLeft: 4,
  },
  fieldCompareItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  matchBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeNewDapodik: {
    fontSize: 10,
    color: '#2563EB',
    fontWeight: 'bold',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dapodikValueBox: {
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dapodikValueLabel: {
    fontSize: 10,
    color: '#475569',
    fontWeight: 'bold',
    marginRight: 4,
  },
  dapodikValueText: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
  },
  btnCopyField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  btnCopyFieldText: {
    fontSize: 10,
    color: '#2a2c87',
    fontWeight: 'bold',
    marginLeft: 2,
  },
  siakadInputBox: {},
  siakadInputLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
  },
  siakadTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#1E293B',
  },
  inputMatch: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  inputMismatch: {
    borderColor: '#FECDD3',
    backgroundColor: '#FFF1F2',
  },
});
