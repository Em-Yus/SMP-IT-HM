import { useState } from 'react';
import { X, FileDown } from 'lucide-react';
import Swal from 'sweetalert2';

export default function ExportModal({ isOpen, onClose, dataToExport, selectedClass }) {
  const [exportTitle, setExportTitle] = useState('');

  const EXPORT_COLUMNS = [
    { id: 'nama', label: 'Nama Lengkap', default: true },
    { id: 'nipd', label: 'NIPD', default: true },
    { id: 'nisn', label: 'NISN', default: true },
    { id: 'nik', label: 'NIK', default: false },
    { id: 'kelas', label: 'Kelas', default: true },
    { id: 'jenis_kelamin', label: 'Jenis Kelamin', default: true },
    { id: 'tempat_lahir', label: 'Tempat Lahir', default: true },
    { id: 'tanggal_lahir', label: 'Tanggal Lahir', default: true },
    { id: 'alamat_detail', label: 'Jalan/Dusun', default: true },
    { id: 'rt_rw', label: 'RT/RW', default: false },
    { id: 'desa', label: 'Desa/Kelurahan', default: false },
    { id: 'kecamatan', label: 'Kecamatan', default: false },
    { id: 'kabupaten', label: 'Kabupaten/Kota', default: false },
    { id: 'provinsi', label: 'Provinsi', default: false },
    { id: 'nama_ayah', label: 'Nama Ayah', default: true },
    { id: 'nama_ibu', label: 'Nama Ibu', default: true },
    { id: 'nama_wali', label: 'Nama Wali', default: false },
    { id: 'wa_ortu', label: 'No WA Ortu', default: true },
    { id: 'wa_siswa', label: 'No WA Siswa', default: false },
    { id: 'sekolah_asal', label: 'Sekolah Asal', default: false },
    { id: 'angkatan', label: 'Angkatan', default: false },
    { id: 'tahun_ajaran', label: 'Tahun Ajaran', default: false },
    { id: 'status_siswa', label: 'Status Siswa (Sifat)', default: false },
    { id: 'tanggal_masuk', label: 'Tanggal Masuk', default: false }
  ];

  const [selectedCols, setSelectedCols] = useState(
    EXPORT_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.default }), {})
  );

  if (!isOpen) return null;

  const handleCheckboxChange = (id) => {
    setSelectedCols(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = (checked) => {
    const nextState = {};
    EXPORT_COLUMNS.forEach(col => {
      nextState[col.id] = checked;
    });
    setSelectedCols(nextState);
  };

  const isAllChecked = Object.values(selectedCols).every(Boolean);

  const processExportExcel = () => {
    const activeCols = EXPORT_COLUMNS.filter(col => selectedCols[col.id]);
    
    if (activeCols.length === 0) {
      Swal.fire('Pilih Kolom', 'Pilih minimal satu kolom untuk di-export.', 'warning');
      return;
    }

    if (!dataToExport || dataToExport.length === 0) {
      Swal.fire('Data Kosong', 'Tidak ada data siswa yang sesuai filter saat ini.', 'warning');
      return;
    }

    // Map data to match selected columns
    const excelData = dataToExport.map((siswa, index) => {
      let rowData = { "No": index + 1 };
      activeCols.forEach(col => {
        let val = siswa[col.id];
        if (col.id === 'rt_rw') {
          val = `RT ${siswa.rt || '-'}/RW ${siswa.rw || '-'}`;
        } else if (col.id === 'tanggal_masuk' || col.id === 'tanggal_lahir') {
          val = val ? new Date(val).toLocaleDateString('id-ID') : '-';
        }
        rowData[col.label] = val || '-';
      });
      return rowData;
    });

    const judulFix = exportTitle.trim() ? exportTitle.toUpperCase() : 'DATA SISWA AKTIF';
    const judulLines = judulFix.split('\n').map(l => l.trim()).filter(l => l !== '');
    const startRowData = Math.max(3, judulLines.length + 2);

    if (typeof window.XLSX === 'undefined') {
      Swal.fire('Error', 'Library Excel (XLSX) gagal dimuat. Pastikan Anda terhubung ke internet.', 'error');
      return;
    }

    const worksheet = window.XLSX.utils.json_to_sheet(excelData, { origin: "A" + startRowData });

    // Add title
    const titleAOA = judulLines.map(line => [line]);
    window.XLSX.utils.sheet_add_aoa(worksheet, titleAOA, { origin: "A1" });

    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Data Siswa");

    const kelasStr = selectedClass && selectedClass !== 'Semua' ? `_Kelas_${selectedClass}` : '_Semua_Kelas';
    const fileName = `Data_Siswa${kelasStr}_${new Date().getTime()}.xlsx`;

    window.XLSX.writeFile(workbook, fileName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full md:w-3/4 max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        <div className="bg-green-600 p-5 rounded-t-2xl flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileDown size={20} /> Export Excel - Pilih Kolom
          </h3>
          <button onClick={onClose} className="text-green-200 hover:text-white transition focus:outline-none">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1 bg-white">
          <p className="text-sm text-gray-500 mb-4">Centang kolom data siswa yang ingin di-export ke dalam file Excel.</p>

          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1 text-gray-600">Judul / Keperluan Tabel</label>
            <textarea 
              value={exportTitle}
              onChange={(e) => setExportTitle(e.target.value)}
              rows="3"
              placeholder="Contoh: DAFTAR SISWA KELAS VII-A&#10;SEMESTER GANJIL"
              className="w-full px-3 py-2 border rounded focus:ring-green-500 focus:border-green-500 uppercase resize-y outline-none"
            ></textarea>
            <p className="text-[10px] text-gray-400 mt-1">Bisa multi-baris (maksimal 5 baris akan tercetak sebagai header di Excel).</p>
          </div>

          <div className="flex items-center gap-2 mb-4 pb-2 border-b">
            <input 
              type="checkbox" 
              id="checkAllCols" 
              checked={isAllChecked}
              onChange={(e) => toggleAll(e.target.checked)}
              className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
            />
            <label htmlFor="checkAllCols" className="text-sm font-bold text-gray-800 cursor-pointer">Pilih Semua Kolom</label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {EXPORT_COLUMNS.map(col => (
              <div key={col.id} className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id={`col_${col.id}`} 
                  checked={selectedCols[col.id] || false}
                  onChange={() => handleCheckboxChange(col.id)}
                  className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                />
                <label htmlFor={`col_${col.id}`} className="text-xs text-gray-700 cursor-pointer select-none">{col.label}</label>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end gap-3 shrink-0 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded border hover:bg-white transition text-sm font-medium text-gray-700">
            Batal
          </button>
          <button type="button" onClick={processExportExcel} className="px-5 py-2 rounded bg-green-600 text-white hover:bg-green-700 transition text-sm font-bold shadow flex items-center gap-2">
            <FileDown size={16} /> Download Excel
          </button>
        </div>

      </div>
    </div>
  );
}
