/**
 * TypeScript Definitions for VerValDapoSis (Verifikasi dan Validasi Data Pokok Siswa)
 * SMP IT HM SIAKAD System
 */

export interface SiswaSIAKAD {
  id: number;
  created_at?: string;
  nik: string | null;
  nisn: string | null;
  nama: string;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  jenis_kelamin: string | null; // 'L' | 'P' | 'Laki-laki' | 'Perempuan'
  alamat_detail: string | null;
  rt: string | null;
  rw: string | null;
  desa: string | null;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  wa_siswa: string | null;
  kelas: string | null;
  angkatan?: string | null;
  tahun_ajaran?: string | null;
  tanggal_masuk?: string | null;
  status_siswa?: string | null;
  status_keaktifan: string;
  sekolah_asal?: string | null;
  nama_ayah: string | null;
  nama_ibu: string | null;
  nama_wali?: string | null;
  wa_ortu?: string | null;
  foto_url?: string | null;
  nipd?: string | null;
  tanggal_non_aktif?: string | null;
  kelas_mengaji?: string | null;
}

export type DapodikRawRow = Record<string, string | number | null | undefined>;

export type FieldType = 'text' | 'digits' | 'date' | 'gender' | 'class';

export interface FieldDefinition {
  key: keyof SiswaSIAKAD | string;
  label: string;
  isEssential: boolean;
  type: FieldType;
  aliases: string[];
  placeholder?: string;
}

export type ColumnMapping = Record<string, string>; // { [siakadKey]: dapodikColumnHeader }

export interface FieldComparisonStatus {
  fieldKey: string;
  label: string;
  siakadValue: string;
  dapodikValue: string;
  isMatch: boolean;
  isEssential: boolean;
  type: FieldType;
}

export type SourceType = 'both' | 'only_siakad' | 'only_dapodik';

export interface StudentValidationResult {
  id: string | number; // Unique synthetic ID for list rendering
  siswa: SiswaSIAKAD | null;
  dapodikRow: DapodikRawRow | null;
  dapodikRowIndex?: number;
  sourceType: SourceType;
  isMatchedInDapodik: boolean;
  isMatchedInSiakad: boolean;
  isValid: boolean;
  fieldStatuses: FieldComparisonStatus[];
  mismatchedFieldsCount: number;
  mismatchedFieldNames: string[];
  displayName: string;
  displayNisn: string;
  displayKelas: string;
  matchedBy?: string | null; // 'Nama Lengkap' | 'NIPD' | 'NISN' | 'NIK' | null
}

export interface VervalSummary {
  totalSiswa: number;
  totalValid: number;
  totalInvalid: number;
  totalBoth: number;
  totalOnlySiakad: number;
  totalOnlyDapodik: number;
  validPercentage: number;
}

export type FilterStatus = 'all' | 'valid' | 'invalid';
export type FilterSource = 'all' | 'both' | 'only_siakad' | 'only_dapodik';
export type SortBy = 'status' | 'name' | 'nisn';
export type SortOrder = 'asc' | 'desc';

export interface VervalFilterSortOptions {
  filterStatus: FilterStatus;
  filterSource: FilterSource;
  filterKelas: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  searchTerm: string;
}
