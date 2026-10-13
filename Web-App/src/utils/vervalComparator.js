import * as XLSX from 'xlsx';

/**
 * Daftar konfigurasi field yang dapat diverifikasi dan divalidasi.
 * Field esensial menentukan status validitas utama siswa.
 */
export const FIELD_DEFINITIONS = [
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

// Bulan dalam Bahasa Indonesia
const INDONESIAN_MONTHS = {
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

/**
 * Normalisasi teks umum (trim, hapus multispasi, lowercase)
 */
export const normalizeText = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

/**
 * Normalisasi digit (hanya angka)
 */
export const normalizeDigits = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/\D/g, '')
    .trim();
};

/**
 * Normalisasi jenis kelamin menjadi 'L' atau 'P'
 */
export const normalizeGender = (val) => {
  if (val === null || val === undefined) return '';
  const s = String(val).trim().toLowerCase();
  if (s === 'l' || s === 'laki-laki' || s === 'laki - laki' || s === 'laki' || s === 'pria' || s === 'm' || s === 'male') {
    return 'L';
  }
  if (s === 'p' || s === 'perempuan' || s === 'wanita' || s === 'f' || s === 'female') {
    return 'P';
  }
  return s.toUpperCase();
};

/**
 * Normalisasi format tanggal menjadi string ISO (YYYY-MM-DD)
 * Menangani serial number Excel, DD/MM/YYYY, YYYY-MM-DD, dan teks tanggal bahasa Indonesia
 */
export const normalizeDate = (val) => {
  if (val === null || val === undefined || val === '') return '';

  // 1. Jika bertipe angka atau serial number Excel (biasanya antara 10000 s.d 60000)
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

  // 2. Format ISO: YYYY-MM-DD atau YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 3. Format umum Indonesia: DD/MM/YYYY atau DD-MM-YYYY
  const idMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (idMatch) {
    const d = idMatch[1].padStart(2, '0');
    const m = idMatch[2].padStart(2, '0');
    const y = idMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 4. Format teks tanggal: "20 Mei 2011" atau "5 Januari 2010"
  const textMatch = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (textMatch) {
    const d = textMatch[1].padStart(2, '0');
    const monthName = textMatch[2].toLowerCase();
    const m = INDONESIAN_MONTHS[monthName] || '01';
    const y = textMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Fallback Date parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str.toLowerCase();
};

/**
 * Normalisasi format kelas / rombel (abaikan spasi dan strip berlebih)
 * Contoh: "VIII A" <=> "VIII-A", "VII 1" <=> "VII-1"
 */
export const normalizeClass = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]+/g, '-');
};

/**
 * Pembanding toleran untuk dua nilai berdasarkan tipe field
 */
export const compareFieldValues = (fieldKey, siakadVal, dapodikVal, fieldType) => {
  const sStr = siakadVal !== null && siakadVal !== undefined ? String(siakadVal) : '';
  const dStr = dapodikVal !== null && dapodikVal !== undefined ? String(dapodikVal) : '';

  // Jika keduanya kosong/null
  if (!sStr.trim() && !dStr.trim()) {
    return { isMatch: true, cleanSiakad: '', cleanDapodik: '' };
  }

  // Jika salah satu kosong tapi yang lain terisi
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
      // Cocok jika digitnya persis sama
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

/**
 * Algoritma Auto-Match cerdas untuk memetakan kolom dari file Dapodik
 * Mencocokkan nama header dengan aliases, kesamaan kata, dan kata kunci
 */
export const autoMatchColumns = (detectedHeaders, definitions = FIELD_DEFINITIONS) => {
  const mapping = {};
  if (!Array.isArray(detectedHeaders) || detectedHeaders.length === 0) {
    return mapping;
  }

  // Bersihkan header untuk komparasi
  const cleanHeaders = detectedHeaders.map(h => ({
    raw: String(h),
    normalized: String(h).trim().toLowerCase().replace(/[_\-./\\]+/g, ' ').replace(/\s+/g, ' ')
  }));

  definitions.forEach(def => {
    // 1. Coba cari exact match di normalized header
    const defKeyNormalized = def.key.toLowerCase().replace(/_/g, ' ');
    const defLabelNormalized = def.label.toLowerCase().replace(/[/.\-_]/g, ' ');

    let matchedHeader = null;

    // Prioritas 1: Exact match dengan key atau label
    const exactMatch = cleanHeaders.find(h => 
      h.normalized === defKeyNormalized || 
      h.normalized === defLabelNormalized ||
      h.raw.toLowerCase() === def.key.toLowerCase()
    );
    if (exactMatch) {
      matchedHeader = exactMatch.raw;
    }

    // Prioritas 2: Cocokkan dengan salah satu alias
    if (!matchedHeader) {
      const aliasMatch = cleanHeaders.find(h => 
        def.aliases.some(alias => {
          const cleanAlias = alias.toLowerCase().replace(/[/.\-_]/g, ' ');
          return h.normalized === cleanAlias;
        })
      );
      if (aliasMatch) {
        matchedHeader = aliasMatch.raw;
      }
    }

    // Prioritas 3: Substring match (jika alias terkandung dalam header)
    if (!matchedHeader) {
      const substringMatch = cleanHeaders.find(h => 
        def.aliases.some(alias => {
          const cleanAlias = alias.toLowerCase().replace(/[/.\-_]/g, ' ');
          // Hindari false-positive pendek seperti 'rt', 'rw', 'jk' jika hanya sebagian kata
          if (cleanAlias.length <= 3) {
            return h.normalized === cleanAlias || h.normalized.split(' ').includes(cleanAlias);
          }
          return h.normalized.includes(cleanAlias);
        })
      );
      if (substringMatch) {
        matchedHeader = substringMatch.raw;
      }
    }

    if (matchedHeader) {
      mapping[def.key] = matchedHeader;
    } else {
      mapping[def.key] = ''; // belum dipetakan
    }
  });

  return mapping;
};

/**
 * Mencari baris siswa di data Dapodik berdasarkan hierarki bertingkat:
 * 1. Nama Lengkap
 * 2. NIPD (Nomor Induk Peserta Didik)
 * 3. NISN (Nomor Induk Siswa Nasional)
 * 4. NIK (Nomor Induk Kependudukan)
 */
export const findDapodikRowWithIndex = (siswa, dapodikRows, mapping, matchedIndices = null) => {
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
      const rowNama = normalizeText(row[namaHeader]);
      return rowNama === cleanSiswaNama;
    });
    if (idx !== -1) return { row: dapodikRows[idx], index: idx, matchedBy: 'Nama Lengkap' };
  }

  // 2. Prioritas 2: NIPD (Nomor Induk Peserta Didik / NIS)
  if (nipdHeader && cleanSiswaNipd && cleanSiswaNipd.length >= 3) {
    const idx = dapodikRows.findIndex((row, i) => {
      if (matchedIndices && matchedIndices.has(i)) return false;
      const rowNipd = normalizeDigits(row[nipdHeader]);
      return rowNipd === cleanSiswaNipd;
    });
    if (idx !== -1) return { row: dapodikRows[idx], index: idx, matchedBy: 'NIPD' };
  }

  // 3. Prioritas 3: NISN
  if (nisnHeader && cleanSiswaNisn && cleanSiswaNisn.length >= 8) {
    const idx = dapodikRows.findIndex((row, i) => {
      if (matchedIndices && matchedIndices.has(i)) return false;
      const rowNisn = normalizeDigits(row[nisnHeader]);
      return rowNisn === cleanSiswaNisn;
    });
    if (idx !== -1) return { row: dapodikRows[idx], index: idx, matchedBy: 'NISN' };
  }

  // 4. Prioritas 4: NIK
  if (nikHeader && cleanSiswaNik && cleanSiswaNik.length >= 10) {
    const idx = dapodikRows.findIndex((row, i) => {
      if (matchedIndices && matchedIndices.has(i)) return false;
      const rowNik = normalizeDigits(row[nikHeader]);
      return rowNik === cleanSiswaNik;
    });
    if (idx !== -1) return { row: dapodikRows[idx], index: idx, matchedBy: 'NIK' };
  }

  return null;
};

/**
 * Mencari baris siswa di data Dapodik berdasarkan hierarki bertingkat
 */
export const findDapodikRow = (siswa, dapodikRows, mapping, matchedIndices = null) => {
  const match = findDapodikRowWithIndex(siswa, dapodikRows, mapping, matchedIndices);
  return match ? match.row : null;
};

/**
 * Validasi per siswa terhadap data Dapodik
 */
export const validateStudent = (siswa, dapodikRow, mapping, definitions = FIELD_DEFINITIONS, matchedBy = null) => {
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
      mismatchedFieldNames: ['Data siswa belum ditemukan di Dapodik'],
      displayName: siswa.nama || '(Tanpa Nama)',
      displayNisn: siswa.nisn || '',
      displayKelas: siswa.kelas || '',
      matchedBy: null
    };
  }

  const fieldStatuses = [];
  const mismatchedFieldNames = [];
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

/**
 * Melakukan full outer join & perbandingan komparatif antara database SIAKAD dan Dapodik:
 * 1. Siswa yang ada di kedua database (SIAKAD & Dapodik) -> sourceType: 'both'
 * 2. Siswa yang hanya ada di SIAKAD (belum/tidak ada di Dapodik) -> sourceType: 'only_siakad'
 * 3. Siswa yang hanya ada di Dapodik (belum terdaftar di SIAKAD) -> sourceType: 'only_dapodik'
 */
export const compareAndMergeStudentDatabases = (dataSiswa = [], dapodikRows = [], mapping = {}, definitions = FIELD_DEFINITIONS) => {
  const isFileLoaded = Array.isArray(dapodikRows) && dapodikRows.length > 0;
  const results = [];
  const matchedDapodikIndices = new Set();

  // 1. Proses seluruh siswa dari SIAKAD
  if (Array.isArray(dataSiswa)) {
    dataSiswa.forEach(siswa => {
      if (!isFileLoaded) {
        // Belum ada file Dapodik diupload
        const fieldStatuses = definitions.map(def => ({
          fieldKey: def.key,
          label: def.label,
          siakadValue: siswa[def.key] !== null && siswa[def.key] !== undefined ? String(siswa[def.key]) : '',
          dapodikValue: '',
          isMatch: false,
          isEssential: def.isEssential,
          type: def.type
        }));

        results.push({
          id: `siswa_${siswa.id}`,
          siswa,
          dapodikRow: null,
          sourceType: 'only_siakad',
          isMatchedInDapodik: false,
          isMatchedInSiakad: true,
          isValid: false,
          fieldStatuses,
          mismatchedFieldsCount: definitions.filter(d => d.isEssential).length,
          mismatchedFieldNames: ['Belum diunggah file Dapodik'],
          displayName: siswa.nama || '(Tanpa Nama)',
          displayNisn: siswa.nisn || '',
          displayKelas: siswa.kelas || '',
          matchedBy: null
        });
        return;
      }

      // Cari baris Dapodik secara bertingkat: Nama Lengkap -> NIPD -> NISN -> NIK
      const match = findDapodikRowWithIndex(siswa, dapodikRows, mapping, matchedDapodikIndices);
      if (match) {
        matchedDapodikIndices.add(match.index);
        const valRes = validateStudent(siswa, match.row, mapping, definitions, match.matchedBy);
        results.push(valRes);
      } else {
        const valRes = validateStudent(siswa, null, mapping, definitions, null);
        results.push(valRes);
      }
    });
  }

  // 2. Proses seluruh siswa yang ADA DI DAPODIK tetapi BELUM ADA DI SIAKAD (Hanya di Dapodik)
  if (isFileLoaded) {
    dapodikRows.forEach((row, index) => {
      if (!matchedDapodikIndices.has(index)) {
        const rawNama = mapping.nama && row[mapping.nama] ? String(row[mapping.nama]).trim() : `Siswa Dapodik #${index + 1}`;
        const rawNisn = mapping.nisn && row[mapping.nisn] ? String(row[mapping.nisn]).trim() : '';
        const rawKelas = mapping.kelas && row[mapping.kelas] ? String(row[mapping.kelas]).trim() : '';

        const fieldStatuses = definitions.map(def => {
          const mappedHeader = mapping[def.key];
          const dapodikVal = mappedHeader && row[mappedHeader] !== undefined ? String(row[mappedHeader]) : '';
          return {
            fieldKey: def.key,
            label: def.label,
            siakadValue: '',
            dapodikValue: dapodikVal,
            isMatch: false,
            isEssential: def.isEssential,
            type: def.type
          };
        });

        results.push({
          id: `dapodik_${index}`,
          siswa: null,
          dapodikRow: row,
          dapodikRowIndex: index,
          sourceType: 'only_dapodik',
          isMatchedInDapodik: true,
          isMatchedInSiakad: false,
          isValid: false, // Belum valid karena belum terdaftar di SIAKAD
          fieldStatuses,
          mismatchedFieldsCount: definitions.filter(d => d.isEssential).length,
          mismatchedFieldNames: ['Belum terdaftar di SIAKAD (Data Baru Dapodik)'],
          displayName: rawNama,
          displayNisn: rawNisn,
          displayKelas: rawKelas
        });
      }
    });
  }

  return results;
};

/**
 * Generate workbook Excel sampel/template Dapodik yang siap diunduh pengguna untuk pengujian
 */
export const generateTemplateWorkbook = () => {
  const sampleHeaders = [
    'Nama Peserta Didik',
    'NISN',
    'NIK',
    'Tempat Lahir',
    'Tanggal Lahir',
    'Jenis Kelamin',
    'Nama Ibu Kandung',
    'Rombel',
    'NIPD',
    'Nama Ayah Kandung',
    'Alamat Jalan',
    'RT',
    'RW',
    'Kelurahan/Desa',
    'Kecamatan',
    'Kabupaten/Kota',
    'Provinsi'
  ];

  const sampleRows = [
    {
      'Nama Peserta Didik': 'AULA ULIL HIDAYAH',
      'NISN': '3114938662',
      'NIK': '3213152005110003',
      'Tempat Lahir': 'Tangerang',
      'Tanggal Lahir': '2011-05-20',
      'Jenis Kelamin': 'L',
      'Nama Ibu Kandung': 'Firiyah',
      'Rombel': 'VIII-A',
      'NIPD': '232408001',
      'Nama Ayah Kandung': 'Hidayat',
      'Alamat Jalan': 'Kp. Babakan No. 10',
      'RT': '01',
      'RW': '02',
      'Kelurahan/Desa': 'Pagaden',
      'Kecamatan': 'Pagaden',
      'Kabupaten/Kota': 'Subang',
      'Provinsi': 'Jawa Barat'
    },
    {
      'Nama Peserta Didik': 'Muhamad Zaky Waliyudi',
      'NISN': '0131059178',
      'NIK': '3213250501130002',
      'Tempat Lahir': 'Subang',
      'Tanggal Lahir': '2013-01-05',
      'Jenis Kelamin': 'L',
      'Nama Ibu Kandung': 'Toipah',
      'Rombel': 'VIII-A',
      'NIPD': '232408002',
      'Nama Ayah Kandung': 'Waliyudi',
      'Alamat Jalan': 'Jl. Veteran No. 45',
      'RT': '03',
      'RW': '04',
      'Kelurahan/Desa': 'Subang',
      'Kecamatan': 'Subang',
      'Kabupaten/Kota': 'Subang',
      'Provinsi': 'Jawa Barat'
    },
    {
      'Nama Peserta Didik': 'Dzikri Izzul Maula',
      'NISN': '0125010463',
      'NIK': '3213151101120002',
      'Tempat Lahir': 'Subang',
      'Tanggal Lahir': '2011-12-02',
      'Jenis Kelamin': 'L',
      'Nama Ibu Kandung': 'Eni Munaeni',
      'Rombel': 'IX-A',
      'NIPD': '222307001',
      'Nama Ayah Kandung': 'Maula',
      'Alamat Jalan': 'Kp. Baru RT 02 RW 01',
      'RT': '02',
      'RW': '01',
      'Kelurahan/Desa': 'Sukamulya',
      'Kecamatan': 'Pagaden Barat',
      'Kabupaten/Kota': 'Subang',
      'Provinsi': 'Jawa Barat'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows, { header: sampleHeaders });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data_Dapodik_Ekspor');
  return wb;
};
