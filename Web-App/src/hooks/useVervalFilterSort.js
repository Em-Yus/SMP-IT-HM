import { useState, useMemo } from 'react';
import { compareAndMergeStudentDatabases, FIELD_DEFINITIONS } from '../utils/vervalComparator';

/**
 * Custom Hook untuk memproses komparasi, filtering, sorting, dan pagination data VerVal Dapodik
 * Mendukung Full Outer Join:
 * - Siswa di kedua sistem (both)
 * - Siswa hanya di SIAKAD (only_siakad)
 * - Siswa hanya di Dapodik (only_dapodik)
 */
export function useVervalFilterSort({
  dataSiswa = [],
  dapodikRows = [],
  columnMapping = {},
  definitions = FIELD_DEFINITIONS,
  initialFilterStatus = 'invalid',
  initialFilterSource = 'all',
  initialSortBy = 'status',
  initialSortOrder = 'asc',
  defaultPageSize = 25
}) {
  const [filterStatus, setFilterStatus] = useState(initialFilterStatus); // 'all' | 'valid' | 'invalid'
  const [filterSource, setFilterSource] = useState(initialFilterSource); // 'all' | 'both' | 'only_siakad' | 'only_dapodik'
  const [filterKelas, setFilterKelas] = useState('all');
  const [sortBy, setSortBy] = useState(initialSortBy); // 'status' | 'name' | 'nisn'
  const [sortOrder, setSortOrder] = useState(initialSortOrder); // 'asc' | 'desc'
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // 1. Eksekusi komparasi & merge kedua database (Outer Join)
  const validationResults = useMemo(() => {
    return compareAndMergeStudentDatabases(dataSiswa, dapodikRows, columnMapping, definitions);
  }, [dataSiswa, dapodikRows, columnMapping, definitions]);

  // 2. Ringkasan / Counter Statistik Komprehensif
  const summary = useMemo(() => {
    const totalSiswa = validationResults.length;
    let totalValid = 0;
    let totalInvalid = 0;
    let totalBoth = 0;
    let totalOnlySiakad = 0;
    let totalOnlyDapodik = 0;

    validationResults.forEach(item => {
      if (item.isValid) {
        totalValid += 1;
      } else {
        totalInvalid += 1;
      }

      if (item.sourceType === 'both') {
        totalBoth += 1;
      } else if (item.sourceType === 'only_siakad') {
        totalOnlySiakad += 1;
      } else if (item.sourceType === 'only_dapodik') {
        totalOnlyDapodik += 1;
      }
    });

    const validPercentage = totalSiswa > 0 
      ? Math.round((totalValid / totalSiswa) * 100) 
      : 0;

    return {
      totalSiswa,
      totalValid,
      totalInvalid,
      totalBoth,
      totalOnlySiakad,
      totalOnlyDapodik,
      validPercentage
    };
  }, [validationResults]);

  // 3. Daftar Opsi Kelas / Rombel unik dari data SIAKAD dan Dapodik
  const availableClasses = useMemo(() => {
    const classes = new Set();
    validationResults.forEach(item => {
      if (item.displayKelas) classes.add(item.displayKelas);
    });
    return Array.from(classes).sort();
  }, [validationResults]);

  // 4. Filtering dan Sorting
  const filteredAndSortedList = useMemo(() => {
    let result = [...validationResults];

    // Filter berdasarkan Status Validasi
    if (filterStatus === 'valid') {
      result = result.filter(item => item.isValid);
    } else if (filterStatus === 'invalid') {
      result = result.filter(item => !item.isValid);
    }

    // Filter berdasarkan Sumber Data (Both / Hanya SIAKAD / Hanya Dapodik)
    if (filterSource !== 'all') {
      result = result.filter(item => item.sourceType === filterSource);
    }

    // Filter berdasarkan Kelas / Rombel
    if (filterKelas !== 'all') {
      result = result.filter(item => item.displayKelas === filterKelas);
    }

    // Pencarian Live (Nama atau NISN atau NIK)
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(item => {
        const nama = (item.displayName || '').toLowerCase();
        const nisn = (item.displayNisn || '').toLowerCase();
        const nik = (item.siswa?.nik || item.dapodikRow?.[columnMapping.nik] || '').toString().toLowerCase();
        return nama.includes(q) || nisn.includes(q) || nik.includes(q);
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'status') {
        // Status: 'asc' berarti Belum Valid di atas (prioritas utama perbaikan)
        // 'desc' berarti Sudah Valid di atas
        const aVal = a.isValid ? 1 : 0;
        const bVal = b.isValid ? 1 : 0;
        if (sortOrder === 'asc') {
          // 0 (invalid) first, then 1 (valid)
          if (aVal !== bVal) return aVal - bVal;
        } else {
          // 1 (valid) first, then 0 (invalid)
          if (aVal !== bVal) return bVal - aVal;
        }
        // Sub-sort: Hanya di Dapodik & Hanya di SIAKAD muncul sebelum mismatch biasa jika sama-sama invalid
        if (a.sourceType !== b.sourceType) {
          const typeWeight = { only_dapodik: 0, only_siakad: 1, both: 2 };
          return (typeWeight[a.sourceType] ?? 3) - (typeWeight[b.sourceType] ?? 3);
        }
        // Sub-sort abjad nama
        return (a.displayName || '').localeCompare(b.displayName || '');
      }

      if (sortBy === 'name') {
        const nameA = a.displayName || '';
        const nameB = b.displayName || '';
        const cmp = nameA.localeCompare(nameB);
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      if (sortBy === 'nisn') {
        const nisnA = a.displayNisn || '';
        const nisnB = b.displayNisn || '';
        const cmp = nisnA.localeCompare(nisnB);
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      return 0;
    });

    return result;
  }, [validationResults, filterStatus, filterSource, filterKelas, searchTerm, sortBy, sortOrder, columnMapping]);

  // 5. Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedList.length / pageSize));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedList.slice(start, start + pageSize);
  }, [filteredAndSortedList, currentPage, pageSize]);

  // Handlers
  const handleSetFilterStatus = (status) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const handleSetFilterSource = (source) => {
    setFilterSource(source);
    setCurrentPage(1);
  };

  const handleSetFilterKelas = (kelas) => {
    setFilterKelas(kelas);
    setCurrentPage(1);
  };

  const handleSetSearchTerm = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleSetSort = (newSortBy, newSortOrder) => {
    setSortBy(newSortBy);
    if (newSortOrder) {
      setSortOrder(newSortOrder);
    }
  };

  return {
    filterStatus,
    setFilterStatus: handleSetFilterStatus,
    filterSource,
    setFilterSource: handleSetFilterSource,
    filterKelas,
    setFilterKelas: handleSetFilterKelas,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    handleSetSort,
    searchTerm,
    setSearchTerm: handleSetSearchTerm,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    summary,
    availableClasses,
    filteredAndSortedList,
    paginatedList,
    totalFilteredCount: filteredAndSortedList.length
  };
}
