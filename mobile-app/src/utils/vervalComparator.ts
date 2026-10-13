export type FieldType = 'text' | 'digits' | 'date' | 'gender' | 'class';

export interface FieldDefinition {
  key: string;
  label: string;
  isEssential: boolean;
  type: FieldType;
  aliases: string[];
  placeholder?: string;
}

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: 'nisn',
    label: 'NISN',
    isEssential: true,
    type: 'digits',
    aliases: ['nisn', 'nomor induk siswa nasional', 'no nisn', 'no. nisn', 'nisn siswa'],
    placeholder: 'Contoh: 0131059178'
  },
  {
    key: 'nik',
    label: 'NIK / No. KK',
    isEssential: true,
    type: 'digits',
    aliases: ['nik', 'nomor induk kependudukan', 'no nik', 'no. nik', 'no kk/nik', 'no. kk', 'no ktp', 'nik peserta didik'],
    placeholder: 'Contoh: 3213152005110003'
  },
  {
    key: 'nama',
    label: 'Nama Lengkap',
    isEssential: true,
    type: 'text',
    aliases: ['nama', 'nama lengkap', 'nama peserta didik', 'nama siswa', 'nama murid', 'student name', 'peserta didik'],
    placeholder: 'Contoh: AHMAD FAUZI'
  },
  {
    key: 'tempat_lahir',
    label: 'Tempat Lahir',
    isEssential: true,
    type: 'text',
    aliases: ['tempat lahir', 'tempat_lahir', 'tmp lahir', 'tmpt lahir', 'tempat'],
    placeholder: 'Contoh: Subang'
  },
  {
    key: 'tanggal_lahir',
    label: 'Tanggal Lahir',
    isEssential: true,
    type: 'date',
    aliases: ['tanggal lahir', 'tanggal_lahir', 'tgl lahir', 'tgl_lahir', 'birth date', 'tgl lahir peserta didik'],
    placeholder: 'YYYY-MM-DD'
  },
  {
    key: 'jenis_kelamin',
    label: 'Jenis Kelamin',
    isEssential: true,
    type: 'gender',
    aliases: ['jenis kelamin', 'jenis_kelamin', 'jk', 'gender', 'sex', 'l/p'],
    placeholder: 'L atau P'
  },
  {
    key: 'nama_ibu',
    label: 'Nama Ibu Kandung',
    isEssential: true,
    type: 'text',
    aliases: ['nama ibu kandung', 'nama ibu', 'ibu kandung', 'nama_ibu', 'ibu', 'ibu kandung peserta didik'],
    placeholder: 'Contoh: Siti Aminah'
  },
  {
    key: 'kelas',
    label: 'Rombel / Kelas',
    isEssential: true,
    type: 'class',
    aliases: ['rombel', 'rombongan belajar', 'kelas', 'tingkat', 'rombel saat ini', 'nama rombel'],
    placeholder: 'Contoh: VII-A'
  },
  {
    key: 'nipd',
    label: 'NIPD / No. Induk',
    isEssential: false,
    type: 'digits',
    aliases: ['nipd', 'no induk', 'nomor induk', 'nis', 'no. induk pd'],
    placeholder: 'Contoh: 232407001'
  },
  {
    key: 'nama_ayah',
    label: 'Nama Ayah Kandung',
    isEssential: false,
    type: 'text',
    aliases: ['nama ayah', 'nama ayah kandung', 'ayah kandung', 'ayah', 'nama bapak', 'nama bapak kandung'],
    placeholder: 'Contoh: Abdullah'
  },
  {
    key: 'alamat_detail',
    label: 'Alamat Jalan',
    isEssential: false,
    type: 'text',
    aliases: ['alamat', 'alamat jalan', 'alamat lengkap', 'jalan', 'dusun', 'alamat peserta didik'],
    placeholder: 'Contoh: Jl. Raya Pagaden No. 12'
  },
  {
    key: 'rt',
    label: 'RT',
    isEssential: false,
    type: 'digits',
    aliases: ['rt', 'no rt'],
    placeholder: 'Contoh: 02'
  },
  {
    key: 'rw',
    label: 'RW',
    isEssential: false,
    type: 'digits',
    aliases: ['rw', 'no rw'],
    placeholder: 'Contoh: 05'
  },
  {
    key: 'desa',
    label: 'Desa / Kelurahan',
    isEssential: false,
    type: 'text',
    aliases: ['desa', 'kelurahan', 'desa/kelurahan', 'nama kelurahan/desa'],
    placeholder: 'Contoh: Sukamulya'
  },
  {
    key: 'kecamatan',
    label: 'Kecamatan',
    isEssential: false,
    type: 'text',
    aliases: ['kecamatan', 'kec', 'nama kecamatan'],
    placeholder: 'Contoh: Pagaden'
  },
  {
    key: 'kabupaten',
    label: 'Kabupaten / Kota',
    isEssential: false,
    type: 'text',
    aliases: ['kabupaten', 'kabupaten/kota', 'kota/kabupaten', 'kab', 'kab/kota'],
    placeholder: 'Contoh: Subang'
  },
  {
    key: 'provinsi',
    label: 'Provinsi',
    isEssential: false,
    type: 'text',
    aliases: ['provinsi', 'prov', 'propinsi'],
    placeholder: 'Contoh: Jawa Barat'
  }
];

const INDONESIAN_MONTHS: Record<string, string> = {
  januari: '01', jan: '01',
  februari: '02', feb: '02',
  maret: '03', mar: '03',
  april: '04', apr: '04',
  mei: '05', may: '05',
  juni: '06', jun: '06',
  juli: '07', jul: '07',
  agustus: '08', agu: '08', ags: '08',
  september: '09', sep: '09', sept: '09',
  oktober: '10', okt: '10', oct: '10',
  november: '11', nov: '11',
  desember: '12', des: '12', dec: '12'
};

export const normalizeText = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/\s+/g, ' ').toLowerCase();
};

export const normalizeDigits = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\D/g, '').trim();
};

export const normalizeGender = (val: any): string => {
  if (!val) return '';
  const s = String(val).trim().toLowerCase();
  if (s === 'l' || s.startsWith('laki') || s === 'pria' || s === 'm' || s === 'male') return 'L';
  if (s === 'p' || s.startsWith('perempuan') || s === 'wanita' || s === 'f' || s === 'female') return 'P';
  return s.toUpperCase();
};

export const normalizeDate = (val: any): string => {
  if (val === null || val === undefined || val === '') return '';

  if (typeof val === 'number' || (!isNaN(val) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    if (num > 10000 && num < 70000) {
      try {
        const utcDays = Math.floor(num - 25569);
        const utcValue = utcDays * 86400;
        const dateInfo = new Date(utcValue * 1000);
        const y = dateInfo.getUTCFullYear();
        const m = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dateInfo.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      } catch (_) {}
    }
  }

  const str = String(val).trim();
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const idMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (idMatch) {
    return `${idMatch[3]}-${idMatch[2].padStart(2, '0')}-${idMatch[1].padStart(2, '0')}`;
  }

  const textMatch = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (textMatch) {
    const d = textMatch[1].padStart(2, '0');
    const monthName = textMatch[2].toLowerCase();
    const m = INDONESIAN_MONTHS[monthName] || '01';
    const y = textMatch[3];
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str.toLowerCase();
};

export const normalizeClass = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim().toUpperCase().replace(/[\s\-_]+/g, '-');
};

export const compareFieldValues = (fieldKey: string, siakadVal: any, dapodikVal: any, fieldType: FieldType) => {
  const sStr = siakadVal !== null && siakadVal !== undefined ? String(siakadVal) : '';
  const dStr = dapodikVal !== null && dapodikVal !== undefined ? String(dapodikVal) : '';

  if (!sStr.trim() && !dStr.trim()) {
    return { isMatch: true, cleanSiakad: '', cleanDapodik: '' };
  }
  if (!sStr.trim() || !dStr.trim()) {
    return { isMatch: false, cleanSiakad: sStr.trim(), cleanDapodik: dStr.trim() };
  }

  let cleanS = sStr.trim();
  let cleanD = dStr.trim();
  let isMatch = false;

  switch (fieldType) {
    case 'digits': {
      const numS = normalizeDigits(cleanS);
      const numD = normalizeDigits(cleanD);
      isMatch = numS === numD && numS.length > 0;
      cleanS = numS;
      cleanD = numD;
      break;
    }
    case 'date': {
      const dateS = normalizeDate(cleanS);
      const dateD = normalizeDate(cleanD);
      isMatch = dateS === dateD && dateS.length > 0;
      cleanS = dateS;
      cleanD = dateD;
      break;
    }
    case 'gender': {
      const genS = normalizeGender(cleanS);
      const genD = normalizeGender(cleanD);
      isMatch = genS === genD && genS.length > 0;
      cleanS = genS;
      cleanD = genD;
      break;
    }
    case 'class': {
      const clsS = normalizeClass(cleanS);
      const clsD = normalizeClass(cleanD);
      isMatch = clsS === clsD;
      cleanS = clsS;
      cleanD = clsD;
      break;
    }
    case 'text':
    default: {
      const txtS = normalizeText(cleanS);
      const txtD = normalizeText(cleanD);
      isMatch = txtS === txtD;
      cleanS = txtS;
      cleanD = txtD;
      break;
    }
  }

  return { isMatch, cleanSiakad: cleanS, cleanDapodik: cleanD };
};

export const autoMatchColumns = (detectedHeaders: string[], definitions = FIELD_DEFINITIONS): Record<string, string> => {
  const mapping: Record<string, string> = {};
  if (!Array.isArray(detectedHeaders) || detectedHeaders.length === 0) return mapping;

  const cleanHeaders = detectedHeaders.map(h => ({
    raw: String(h),
    normalized: String(h).trim().toLowerCase().replace(/[_\-./\\]+/g, ' ').replace(/\s+/g, ' ')
  }));

  definitions.forEach(def => {
    const defKeyNormalized = def.key.toLowerCase().replace(/_/g, ' ');
    const defLabelNormalized = def.label.toLowerCase().replace(/[/.\-_]/g, ' ');
    let matchedHeader: string | null = null;

    const exactMatch = cleanHeaders.find(h => 
      h.normalized === defKeyNormalized || 
      h.normalized === defLabelNormalized ||
      h.raw.toLowerCase() === def.key.toLowerCase()
    );
    if (exactMatch) matchedHeader = exactMatch.raw;

    if (!matchedHeader) {
      const aliasMatch = cleanHeaders.find(h => 
        def.aliases.some(alias => h.normalized === alias.toLowerCase().replace(/[/.\-_]/g, ' '))
      );
      if (aliasMatch) matchedHeader = aliasMatch.raw;
    }

    if (!matchedHeader) {
      const subMatch = cleanHeaders.find(h => 
        def.aliases.some(alias => {
          const c = alias.toLowerCase().replace(/[/.\-_]/g, ' ');
          if (c.length <= 3) return h.normalized === c || h.normalized.split(' ').includes(c);
          return h.normalized.includes(c);
        })
      );
      if (subMatch) matchedHeader = subMatch.raw;
    }

    mapping[def.key] = matchedHeader || '';
  });

  return mapping;
};

/**
 * Pencocokan siswa bertingkat:
 * 1. Nama Lengkap
 * 2. NIPD
 * 3. NISN
 * 4. NIK
 */
export const findDapodikRowWithIndex = (
  siswa: any, 
  dapodikRows: any[], 
  mapping: Record<string, string>, 
  matchedIndices: Set<number> | null = null
): { row: any; index: number; matchedBy: string } | null => {
  if (!dapodikRows || !dapodikRows.length) return null;

  const namaHeader = mapping.nama;
  const nipdHeader = mapping.nipd;
  const nisnHeader = mapping.nisn;
  const nikHeader = mapping.nik;

  const cleanSiswaNama = normalizeText(siswa.nama);
  const cleanSiswaNipd = normalizeDigits(siswa.nipd);
  const cleanSiswaNisn = normalizeDigits(siswa.nisn);
  const cleanSiswaNik = normalizeDigits(siswa.nik);

  // 1. Prioritas 1: Nama Lengkap
  if (namaHeader && cleanSiswaNama && cleanSiswaNama.length > 2) {
    const idx = dapodikRows.findIndex((row, i) => {
      if (matchedIndices && matchedIndices.has(i)) return false;
      return normalizeText(row[namaHeader]) === cleanSiswaNama;
    });
    if (idx !== -1) return { row: dapodikRows[idx], index: idx, matchedBy: 'Nama Lengkap' };
  }

  // 2. Prioritas 2: NIPD
  if (nipdHeader && cleanSiswaNipd && cleanSiswaNipd.length >= 3) {
    const idx = dapodikRows.findIndex((row, i) => {
      if (matchedIndices && matchedIndices.has(i)) return false;
      return normalizeDigits(row[nipdHeader]) === cleanSiswaNipd;
    });
    if (idx !== -1) return { row: dapodikRows[idx], index: idx, matchedBy: 'NIPD' };
  }

  // 3. Prioritas 3: NISN
  if (nisnHeader && cleanSiswaNisn && cleanSiswaNisn.length >= 8) {
    const idx = dapodikRows.findIndex((row, i) => {
      if (matchedIndices && matchedIndices.has(i)) return false;
      return normalizeDigits(row[nisnHeader]) === cleanSiswaNisn;
    });
    if (idx !== -1) return { row: dapodikRows[idx], index: idx, matchedBy: 'NISN' };
  }

  // 4. Prioritas 4: NIK
  if (nikHeader && cleanSiswaNik && cleanSiswaNik.length >= 10) {
    const idx = dapodikRows.findIndex((row, i) => {
      if (matchedIndices && matchedIndices.has(i)) return false;
      return normalizeDigits(row[nikHeader]) === cleanSiswaNik;
    });
    if (idx !== -1) return { row: dapodikRows[idx], index: idx, matchedBy: 'NIK' };
  }

  return null;
};

export interface FieldComparisonStatus {
  fieldKey: string;
  label: string;
  siakadValue: string;
  dapodikValue: string;
  isMatch: boolean;
  isEssential: boolean;
  type: FieldType;
}

export interface StudentValidationResult {
  id: string | number;
  siswa: any | null;
  dapodikRow: any | null;
  dapodikRowIndex?: number;
  sourceType: 'both' | 'only_siakad' | 'only_dapodik';
  isMatchedInDapodik: boolean;
  isMatchedInSiakad: boolean;
  isValid: boolean;
  fieldStatuses: FieldComparisonStatus[];
  mismatchedFieldsCount: number;
  mismatchedFieldNames: string[];
  displayName: string;
  displayNisn: string;
  displayKelas: string;
  matchedBy?: string | null;
}

export const validateStudent = (
  siswa: any, 
  dapodikRow: any, 
  mapping: Record<string, string>, 
  definitions = FIELD_DEFINITIONS,
  matchedBy: string | null = null
): StudentValidationResult => {
  if (!dapodikRow) {
    const fieldStatuses = definitions.map(def => ({
      fieldKey: def.key,
      label: def.label,
      siakadValue: siswa[def.key] !== null && siswa[def.key] !== undefined ? String(siswa[def.key]) : '',
      dapodikValue: '',
      isMatch: false,
      isEssential: def.isEssential,
      type: def.type
    }));

    return {
      id: `siswa_${siswa.id}`,
      siswa,
      dapodikRow: null,
      sourceType: 'only_siakad',
      isMatchedInDapodik: false,
      isMatchedInSiakad: true,
      isValid: false,
      fieldStatuses,
      mismatchedFieldsCount: definitions.filter(d => d.isEssential).length,
      mismatchedFieldNames: ['Data belum ada di file Dapodik'],
      displayName: siswa.nama || '(Tanpa Nama)',
      displayNisn: siswa.nisn || '',
      displayKelas: siswa.kelas || '',
      matchedBy: null
    };
  }

  const fieldStatuses: FieldComparisonStatus[] = [];
  const mismatchedFieldNames: string[] = [];
  let allEssentialMatch = true;

  definitions.forEach(def => {
    const mappedHeader = mapping[def.key];
    const siakadVal = siswa[def.key] !== null && siswa[def.key] !== undefined ? String(siswa[def.key]) : '';
    const dapodikVal = mappedHeader && dapodikRow[mappedHeader] !== undefined ? String(dapodikRow[mappedHeader]) : '';

    let isMatch = false;
    if (!mappedHeader) {
      isMatch = false;
      if (def.isEssential) {
        allEssentialMatch = false;
        mismatchedFieldNames.push(`${def.label} (Kolom belum dipetakan)`);
      }
    } else {
      const comp = compareFieldValues(def.key, siakadVal, dapodikVal, def.type);
      isMatch = comp.isMatch;
      if (def.isEssential && !isMatch) {
        allEssentialMatch = false;
        mismatchedFieldNames.push(def.label);
      }
    }

    fieldStatuses.push({
      fieldKey: def.key,
      label: def.label,
      siakadValue: siakadVal,
      dapodikValue: dapodikVal,
      isMatch,
      isEssential: def.isEssential,
      type: def.type
    });
  });

  return {
    id: `siswa_${siswa.id}`,
    siswa,
    dapodikRow,
    sourceType: 'both',
    isMatchedInDapodik: true,
    isMatchedInSiakad: true,
    isValid: allEssentialMatch,
    fieldStatuses,
    mismatchedFieldsCount: mismatchedFieldNames.length,
    mismatchedFieldNames,
    displayName: siswa.nama || '(Tanpa Nama)',
    displayNisn: siswa.nisn || '',
    displayKelas: siswa.kelas || '',
    matchedBy
  };
};

export const compareAndMergeStudentDatabases = (
  dataSiswa: any[] = [], 
  dapodikRows: any[] = [], 
  mapping: Record<string, string> = {}, 
  definitions = FIELD_DEFINITIONS
): StudentValidationResult[] => {
  const isFileLoaded = Array.isArray(dapodikRows) && dapodikRows.length > 0;
  const results: StudentValidationResult[] = [];
  const matchedDapodikIndices = new Set<number>();

  if (Array.isArray(dataSiswa)) {
    dataSiswa.forEach(siswa => {
      if (!isFileLoaded) {
        results.push(validateStudent(siswa, null, mapping, definitions, null));
        return;
      }

      const match = findDapodikRowWithIndex(siswa, dapodikRows, mapping, matchedDapodikIndices);
      if (match) {
        matchedDapodikIndices.add(match.index);
        results.push(validateStudent(siswa, match.row, mapping, definitions, match.matchedBy));
      } else {
        results.push(validateStudent(siswa, null, mapping, definitions, null));
      }
    });
  }

  if (isFileLoaded) {
    dapodikRows.forEach((row, index) => {
      if (!matchedDapodikIndices.has(index)) {
        const rawNama = mapping.nama && row[mapping.nama] ? String(row[mapping.nama]).trim() : `Siswa Dapodik #${index + 1}`;
        const rawNisn = mapping.nisn && row[mapping.nisn] ? String(row[mapping.nisn]).trim() : '';
        const rawKelas = mapping.kelas && row[mapping.kelas] ? String(row[mapping.kelas]).trim() : '';

        const fieldStatuses = definitions.map(def => ({
          fieldKey: def.key,
          label: def.label,
          siakadValue: '',
          dapodikValue: mapping[def.key] && row[mapping[def.key]] !== undefined ? String(row[mapping[def.key]]) : '',
          isMatch: false,
          isEssential: def.isEssential,
          type: def.type
        }));

        results.push({
          id: `dapodik_${index}`,
          siswa: null,
          dapodikRow: row,
          dapodikRowIndex: index,
          sourceType: 'only_dapodik',
          isMatchedInDapodik: true,
          isMatchedInSiakad: false,
          isValid: false,
          fieldStatuses,
          mismatchedFieldsCount: definitions.filter(d => d.isEssential).length,
          mismatchedFieldNames: ['Belum terdaftar di SIAKAD (Data Baru)'],
          displayName: rawNama,
          displayNisn: rawNisn,
          displayKelas: rawKelas,
          matchedBy: null
        });
      }
    });
  }

  return results;
};
