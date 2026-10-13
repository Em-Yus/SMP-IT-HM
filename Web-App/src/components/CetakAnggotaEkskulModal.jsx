import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { X, FileDown, Printer, CheckSquare, Square, Users, Tent, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

export default function CetakAnggotaEkskulModal({ isOpen, onClose, ekskulData }) {
  const [dataLembaga, setDataLembaga] = useState(null);
  const [anggotaList, setAnggotaList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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
    { id: 'tanggal_masuk', label: 'Tanggal Masuk', default: false },
    // Kolom data capaian ekskul
    { id: 'tingkat', label: 'Tingkat (Ramu/Rakit/Terap)', default: true },
    { id: 'predikat', label: 'Predikat', default: true },
    { id: 'deskripsi', label: 'Deskripsi Capaian', default: true }
  ];

  const [selectedCols, setSelectedCols] = useState(
    EXPORT_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.default }), {})
  );

  useEffect(() => {
    if (!isOpen || !ekskulData) return;

    // Reset default title
    const defTitle = `DAFTAR ANGGOTA EKSTRAKURIKULER ${ekskulData.nama_ekskul?.toUpperCase() || ''}\nSMP IT HIDAYATUL MUBTADI-IEN\nTAHUN AJARAN ${ekskulData.tahun_ajaran || ''} (${(ekskulData.semester || '').toUpperCase()})`;
    setExportTitle(defTitle);

    const fetchAnggotaAndLembaga = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch data lembaga
        const { data: lembaga } = await supabase.from('data_lembaga').select('*').maybeSingle();
        if (lembaga) setDataLembaga(lembaga);

        // 2. Fetch anggota_ekskul join data_siswa
        let members = [];
        try {
          const resMembers = await supabase
            .from('anggota_ekskul')
            .select(`
              id,
              ekskul_id,
              siswa_id,
              predikat,
              deskripsi,
              tingkat,
              data_siswa (*)
            `)
            .eq('ekskul_id', ekskulData.id);

          if (resMembers.error) throw resMembers.error;
          members = resMembers.data || [];
        } catch {
          const resFallback = await supabase
            .from('anggota_ekskul')
            .select(`
              id,
              ekskul_id,
              siswa_id,
              predikat,
              deskripsi,
              data_siswa (*)
            `)
            .eq('ekskul_id', ekskulData.id);

          if (resFallback.error) throw resFallback.error;
          members = resFallback.data || [];
        }

        // Normalize tingkat & deskripsi
        const normalized = (members || []).map(m => {
          let t = m.tingkat;
          let d = m.deskripsi || '';
          if (!t && d) {
            const match = d.match(/^\[Tingkat:\s*([^\]]+)\]\s*/i);
            if (match) {
              t = match[1];
              d = d.replace(match[0], '');
            }
          }
          if (Array.isArray(t)) t = t.join(', ');
          return {
            ...m,
            tingkat: t || '',
            deskripsi: d
          };
        });

        // Sort by kelas then by nama
        const sorted = normalized.sort((a, b) => {
          const klsA = a.data_siswa?.kelas || '';
          const klsB = b.data_siswa?.kelas || '';
          if (klsA !== klsB) return klsA.localeCompare(klsB);
          return (a.data_siswa?.nama || '').localeCompare(b.data_siswa?.nama || '');
        });

        setAnggotaList(sorted);
      } catch (err) {
        console.error('Error fetching anggota data:', err);
        Swal.fire('Error', 'Gagal memuat data anggota untuk dicetak.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnggotaAndLembaga();
  }, [isOpen, ekskulData]);

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

  const getActiveCols = () => EXPORT_COLUMNS.filter(col => selectedCols[col.id]);

  const getFormattedValue = (anggota, colId) => {
    const siswa = anggota.data_siswa || {};
    if (colId === 'tingkat') return anggota.tingkat || '-';
    if (colId === 'predikat') return anggota.predikat || '-';
    if (colId === 'deskripsi') return anggota.deskripsi || '-';
    if (colId === 'rt_rw') return `RT ${siswa.rt || '-'}/RW ${siswa.rw || '-'}`;
    if (colId === 'tanggal_masuk' || colId === 'tanggal_lahir') {
      return siswa[colId] ? new Date(siswa[colId]).toLocaleDateString('id-ID') : '-';
    }
    if (colId === 'jenis_kelamin') {
      const jk = siswa.jenis_kelamin;
      if (jk === 'L') return 'Laki-laki';
      if (jk === 'P') return 'Perempuan';
      return jk || '-';
    }
    return siswa[colId] || '-';
  };

  // --- 1. EXPORT EXCEL ---
  const handleExportExcel = () => {
    const activeCols = getActiveCols();
    if (activeCols.length === 0) {
      Swal.fire('Pilih Kolom', 'Pilih minimal satu kolom untuk diekspor.', 'warning');
      return;
    }

    if (anggotaList.length === 0) {
      Swal.fire('Data Kosong', 'Belum ada anggota terdaftar pada ekstrakurikuler ini.', 'warning');
      return;
    }

    // Map data
    const excelData = anggotaList.map((anggota, index) => {
      const row = { "No": index + 1 };
      activeCols.forEach(col => {
        row[col.label] = getFormattedValue(anggota, col.id);
      });
      return row;
    });

    const judulFix = exportTitle.trim() ? exportTitle.toUpperCase() : `DATA ANGGOTA EKSTRAKURIKULER ${ekskulData.nama_ekskul?.toUpperCase()}`;
    const judulLines = judulFix.split('\n').map(l => l.trim()).filter(Boolean);
    const startRowData = Math.max(3, judulLines.length + 2);

    const worksheet = XLSX.utils.json_to_sheet(excelData, { origin: "A" + startRowData });

    // Add title lines
    const titleAOA = judulLines.map(line => [line]);
    XLSX.utils.sheet_add_aoa(worksheet, titleAOA, { origin: "A1" });

    // Auto-fit column width
    const colWidths = [{ wch: 6 }]; // No
    activeCols.forEach(col => {
      const maxLen = Math.max(
        col.label.length,
        ...excelData.map(r => String(r[col.label] || '').length)
      );
      colWidths.push({ wch: Math.min(Math.max(maxLen + 3, 12), 40) });
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Anggota Ekskul");

    const safeEkskulName = (ekskulData.nama_ekskul || 'Ekskul').replace(/[/\\?%*:|"<>]/g, '_');
    const safeTA = (ekskulData.tahun_ajaran || '').replace('/', '-');
    const fileName = `Data_Anggota_${safeEkskulName}_${safeTA}_${ekskulData.semester || ''}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    Swal.fire({
      icon: 'success',
      title: 'Berhasil Diekspor',
      text: `File Excel ${fileName} berhasil diunduh.`,
      timer: 2000,
      showConfirmButton: false
    });
    onClose();
  };

  // --- 2. CETAK DOKUMEN (PRINT VIEW) ---
  const handlePrintDocument = () => {
    const activeCols = getActiveCols();
    if (activeCols.length === 0) {
      Swal.fire('Pilih Kolom', 'Pilih minimal satu kolom untuk dicetak.', 'warning');
      return;
    }

    if (anggotaList.length === 0) {
      Swal.fire('Data Kosong', 'Belum ada anggota terdaftar pada ekstrakurikuler ini.', 'warning');
      return;
    }

    // Buat iframe atau jendela cetak dengan styling kop surat resmi
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Swal.fire('Popup Diblokir', 'Harap izinkan popup browser untuk mencetak dokumen.', 'warning');
      return;
    }

    const namaLembaga = dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN';
    const alamatLembaga = dataLembaga?.alamat || 'Jl. Raya Compreng - Subang, Jawa Barat';
    const logoLembaga = dataLembaga?.logo || 'https://www.e-ujian.com/smpithm/logo';
    const npsnLembaga = dataLembaga?.npsn ? `NPSN: ${dataLembaga.npsn}` : '';
    const emailLembaga = dataLembaga?.email ? `Email: ${dataLembaga.email}` : '';
    const kontakLine = [npsnLembaga, emailLembaga].filter(Boolean).join(' | ');

    const tanggalHariIni = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const printHtml = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Daftar Anggota ${ekskulData.nama_ekskul || 'Ekstrakurikuler'}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            line-height: 1.3;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 0;
          }
          .kop-container {
            display: flex;
            align-items: center;
            justify-content: center;
            border-bottom: 3px double #000;
            padding-bottom: 8px;
            margin-bottom: 16px;
            text-align: center;
          }
          .kop-logo {
            width: 75px;
            height: 75px;
            object-fit: contain;
            margin-right: 18px;
          }
          .kop-text h2 {
            font-size: 13pt;
            font-weight: normal;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .kop-text h1 {
            font-size: 16pt;
            font-weight: 900;
            margin: 2px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .kop-text p {
            font-size: 9pt;
            margin: 0;
            font-style: italic;
          }
          .judul-dokumen {
            text-align: center;
            margin: 14px 0 16px 0;
          }
          .judul-dokumen h3 {
            font-size: 13pt;
            font-weight: bold;
            text-transform: uppercase;
            text-decoration: underline;
            margin: 0;
          }
          .judul-dokumen p {
            font-size: 10pt;
            margin: 4px 0 0 0;
            font-weight: 600;
          }
          .meta-table {
            width: 100%;
            margin-bottom: 14px;
            font-size: 10pt;
          }
          .meta-table td {
            padding: 2px 4px;
            vertical-align: top;
          }
          .meta-table td.label {
            width: 140px;
            font-weight: 600;
          }
          .meta-table td.separator {
            width: 15px;
            text-align: center;
          }
          table.data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 9.5pt;
          }
          table.data-table th, table.data-table td {
            border: 1px solid #000;
            padding: 5px 6px;
            vertical-align: top;
          }
          table.data-table th {
            background-color: #f1f5f9;
            text-align: center;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 9pt;
          }
          table.data-table td.center {
            text-align: center;
          }
          .signature-section {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .signature-box {
            width: 42%;
            text-align: center;
            font-size: 10.5pt;
          }
          .signature-space {
            height: 75px;
          }
          .signature-name {
            font-weight: bold;
            text-decoration: underline;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="kop-container">
          <img src="${logoLembaga}" alt="Logo" class="kop-logo" onerror="this.style.display='none'" />
          <div class="kop-text">
            <h2>YAYASAN PONDOK PESANTREN HIDAYATUL MUBTADI-IEN</h2>
            <h1>${namaLembaga}</h1>
            <p>${alamatLembaga}</p>
            ${kontakLine ? `<p>${kontakLine}</p>` : ''}
          </div>
        </div>

        <div class="judul-dokumen">
          <h3>DAFTAR ANGGOTA EKSTRAKURIKULER</h3>
          <p>TAHUN AJARAN ${ekskulData.tahun_ajaran || ''} • SEMESTER ${(ekskulData.semester || '').toUpperCase()}</p>
        </div>

        <table class="meta-table">
          <tr>
            <td class="label">Nama Ekstrakurikuler</td>
            <td class="separator">:</td>
            <td><strong>${ekskulData.nama_ekskul || '-'}</strong></td>
            <td class="label">Tahun Ajaran / Semester</td>
            <td class="separator">:</td>
            <td>${ekskulData.tahun_ajaran || '-'} (${ekskulData.semester || '-'})</td>
          </tr>
          <tr>
            <td class="label">Guru Pembina</td>
            <td class="separator">:</td>
            <td>${ekskulData.pembina_nama || '-'}</td>
            <td class="label">Jumlah Anggota</td>
            <td class="separator">:</td>
            <td><strong>${anggotaList.length} Siswa</strong></td>
          </tr>
          <tr>
            <td class="label">Jadwal Latihan</td>
            <td class="separator">:</td>
            <td colspan="4">${ekskulData.hari_pelaksanaan || '-'} ${ekskulData.jam_pelaksanaan ? `(${ekskulData.jam_pelaksanaan})` : ''}</td>
          </tr>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 32px;">No</th>
              ${activeCols.map(col => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${anggotaList.map((anggota, idx) => `
              <tr>
                <td class="center">${idx + 1}</td>
                ${activeCols.map(col => {
                  const val = getFormattedValue(anggota, col.id);
                  const isCenter = ['nipd', 'nisn', 'nik', 'kelas', 'jenis_kelamin', 'tanggal_lahir', 'predikat'].includes(col.id);
                  return `<td class="${isCenter ? 'center' : ''}">${val}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="signature-section">
          <div class="signature-box">
            <p>Mengetahui,<br>Kepala Sekolah</p>
            <div class="signature-space"></div>
            <p class="signature-name">${dataLembaga?.kepala_sekolah || 'Ustadz Iwan Supriyanto, S.Pd.I'}</p>
            <p>NIY/NIP. ${dataLembaga?.nip_kepsek || '-'}</p>
          </div>
          <div class="signature-box">
            <p>Compreng, ${tanggalHariIni}<br>Pembina Ekstrakurikuler</p>
            <div class="signature-space"></div>
            <p class="signature-name">${ekskulData.pembina_nama || '....................................'}</p>
            <p>NIP/NIY. -</p>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#2a2c87] p-5 text-white flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Printer size={20} className="text-[#85c226]" /> Cetak & Ekspor Data Anggota
            </h3>
            <p className="text-xs text-blue-100 mt-1">
              Ekskul: <span className="font-bold text-white">{ekskulData?.nama_ekskul}</span> • TA: {ekskulData?.tahun_ajaran} ({ekskulData?.semester})
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition">
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto p-6 flex-1 bg-white">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2a2c87] mb-3"></div>
              <p className="text-sm text-gray-500 font-medium">Memuat data anggota...</p>
            </div>
          ) : anggotaList.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-800">
              <AlertCircle size={32} className="mx-auto text-amber-600 mb-2" />
              <h4 className="font-bold text-base">Belum Ada Anggota Terdaftar</h4>
              <p className="text-sm mt-1 text-amber-700">
                Ekstrakurikuler ini belum memiliki anggota pada TA {ekskulData?.tahun_ajaran} Semester {ekskulData?.semester}.
                Silakan tambahkan siswa melalui menu <strong>Kelola Anggota</strong> terlebih dahulu.
              </p>
            </div>
          ) : (
            <>
              {/* Member overview badge */}
              <div className="flex items-center justify-between bg-blue-50/70 border border-blue-100 p-3.5 rounded-xl mb-4 text-sm">
                <div className="flex items-center gap-2 text-[#2a2c87] font-semibold">
                  <Users size={18} />
                  <span>Total Anggota Terdaftar:</span>
                  <span className="bg-[#2a2c87] text-white px-2 py-0.5 rounded-md font-bold text-xs">
                    {anggotaList.length} Siswa
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Pembina: <strong className="text-gray-700">{ekskulData?.pembina_nama || '-'}</strong>
                </div>
              </div>

              {/* Judul Dokumen */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Judul / Header Dokumen (Excel & Cetak)
                </label>
                <textarea
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-transparent text-xs font-medium resize-y outline-none"
                  placeholder="Judul dokumen..."
                />
              </div>

              {/* Toggle All Columns */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => toggleAll(!isAllChecked)}
                  className="flex items-center gap-2 text-sm font-bold text-[#2a2c87] hover:text-blue-900 transition"
                >
                  {isAllChecked ? <CheckSquare size={18} className="text-[#85c226]" /> : <Square size={18} className="text-gray-400" />}
                  <span>{isAllChecked ? 'Batalkan Pilih Semua' : 'Pilih Semua Kolom'}</span>
                </button>
                <span className="text-xs text-gray-400">
                  {getActiveCols().length} dari {EXPORT_COLUMNS.length} kolom terpilih
                </span>
              </div>

              {/* Checkboxes grid matching DataSiswa export */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-gray-50/60 p-3.5 rounded-xl border border-gray-100 max-h-60 overflow-y-auto">
                {EXPORT_COLUMNS.map(col => {
                  const isChecked = !!selectedCols[col.id];
                  const isHighlight = col.id === 'predikat' || col.id === 'deskripsi';
                  return (
                    <label
                      key={col.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition border ${
                        isChecked 
                          ? isHighlight ? 'bg-green-50/80 border-green-200 text-green-900 font-bold' : 'bg-white border-blue-200 text-gray-800 font-medium shadow-xs' 
                          : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheckboxChange(col.id)}
                        className="w-4 h-4 text-[#85c226] rounded focus:ring-[#85c226] cursor-pointer"
                      />
                      <span className="truncate">{col.label}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-bold text-sm transition"
          >
            Tutup
          </button>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrintDocument}
              disabled={isLoading || anggotaList.length === 0}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={16} /> Cetak / Print PDF
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isLoading || anggotaList.length === 0}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown size={16} /> Download Excel (.xlsx)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
